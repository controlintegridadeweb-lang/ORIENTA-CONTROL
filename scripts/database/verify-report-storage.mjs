/**
 * Exercita o Storage real do Supabase local: reserva documental → upload sem
 * sobrescrita → finalização criptográfica → URL assinada → download.
 * Não depende de Next nem de mocks; roda após db:verify no CI.
 */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { loadEnv } from "../shared/load-env.mjs";

loadEnv();

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
if (!url || !key) {
  console.error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.");
  process.exit(2);
}
if (!databaseUrl) {
  console.error("DATABASE_URL é obrigatório para preparar o fixture concluído.");
  process.exit(2);
}

const ids = {
  organization: "00000000-0000-0000-0000-0000000000b1",
  formVersion: "00000000-0000-0000-0000-000000000bb1",
  cycle: "00000000-0000-0000-0000-00000000c0f8",
  processing: "00000000-0000-0000-0000-00000000e0f8",
  actor: "00000000-0000-0000-0000-0000000000a1",
};
const bucket = "relatorios";
const client = createClient(url, key, { auth: { persistSession: false } });
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
const fileSha256 = createHash("sha256").update(pdf).digest("hex");
const contentSha256 = createHash("sha256").update("report-storage-verification").digest("hex");
let reportId = null;
let path = null;

function sqlUuid(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`UUID inválido no fixture de relatório: ${value}`);
  }
  return `'${value}'::uuid`;
}

async function runFixtureSql(sql) {
  const db = new pg.Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    await db.query(sql);
  } finally {
    await db.end();
  }
}

async function prepareCompletedCycle() {
  await runFixtureSql(`
    begin;
    set local session_replication_role = replica;
    insert into public.cycles(
      id, form_version_id, organization_id, period_label,
      reference_start_year, reference_end_year, action_plan_revision,
      state, closed_at, period_id
    ) values (
      ${sqlUuid(ids.cycle)}, ${sqlUuid(ids.formVersion)}, ${sqlUuid(ids.organization)},
      'Ciclo institucional', 2026, 2026, 0, 'completed', now(),
      (public.ensure_form_period(${sqlUuid(ids.formVersion)}, 'report-storage-verification', 'report-storage-verification')).id
    )
    on conflict (id) do update set
      state = 'completed', closed_at = excluded.closed_at,
      reference_start_year = 2026, reference_end_year = 2026,
      action_plan_revision = 0,
      period_id = excluded.period_id;

    insert into public.cycle_processings(
      id, cycle_id, processing_version, status, completed_at
    ) values (${sqlUuid(ids.processing)}, ${sqlUuid(ids.cycle)}, 1, 'completed', now())
    on conflict (id) do update
      set status = 'completed', completed_at = excluded.completed_at;
    commit;
  `);
}

async function cleanupFixture() {
  const reportDelete = reportId
    ? `delete from public.reports where id = ${sqlUuid(reportId)};`
    : "";
  await runFixtureSql(`
    begin;
    set local session_replication_role = replica;
    ${reportDelete}
    delete from public.cycle_processings where id = ${sqlUuid(ids.processing)};
    delete from public.cycles where id = ${sqlUuid(ids.cycle)};
    delete from public.form_periods
    where form_version_id = ${sqlUuid(ids.formVersion)}
      and period_code = 'report-storage-verification';
    commit;
  `);
  if (path) await client.storage.from(bucket).remove([path]);
}

try {
  await prepareCompletedCycle();

  const { data: reserved, error: reserveError } = await client.rpc("reserve_report_emission", {
    p_cycle_id: ids.cycle,
    p_cycle_processing_id: ids.processing,
    p_generated_by: ids.actor,
    p_expected_action_plan_revision: 0,
    p_generated_at: new Date().toISOString(),
    p_reissue_reason: undefined,
  });
  if (reserveError) throw reserveError;
  if (!reserved?.id || !reserved.file_path || reserved.emission_version !== 1) {
    throw new Error("A RPC não reservou a emissão inicial esperada.");
  }
  reportId = reserved.id;
  path = reserved.file_path;

  const { error: uploadError } = await client.storage.from(bucket).upload(path, pdf, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data: finalized, error: finalizeError } = await client.rpc("finalize_report_emission", {
    p_report_id: reportId,
    p_file_sha256: fileSha256,
    p_content_sha256: contentSha256,
    p_file_size_bytes: pdf.byteLength,
  });
  if (finalizeError) throw finalizeError;
  if (finalized?.status !== "completed" || finalized.file_sha256 !== fileSha256) {
    throw new Error("A emissão não foi finalizada com a integridade esperada.");
  }

  const { data: signed, error: signedError } = await client.storage
    .from(bucket)
    .createSignedUrl(path, 60);
  if (signedError || !signed?.signedUrl) throw signedError ?? new Error("URL assinada vazia.");

  const response = await fetch(signed.signedUrl);
  if (!response.ok) throw new Error(`Download da URL assinada falhou: HTTP ${response.status}.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const downloadedHash = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== pdf.length || downloadedHash !== fileSha256) {
    throw new Error("O PDF baixado não corresponde à emissão finalizada.");
  }

  console.log("REPORT STORAGE SIGNED URL: OK");
} finally {
  try { await cleanupFixture(); }
  catch (cleanupError) { console.error("Falha ao limpar fixture de relatório:", cleanupError); }
}
