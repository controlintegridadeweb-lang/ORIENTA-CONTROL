/**
 * Integração real (PGlite) das RPCs de gestão de formulário:
 * prazo excepcional, pausa, reabertura parcial e reabertura de validação
 * com preservação de FAMI.
 *
 * Uso: node scripts/database/form-management-rpc-pglite.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const migDir = path.join(root, "supabase/migrations");
const reportPath = path.join(root, "var/form-management-rpc-pglite-report.json");

const PREAMBLE = `
create schema if not exists extensions;
grant usage on schema extensions to public;
create extension if not exists pgcrypto with schema extensions;
set search_path to public, extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='service_role') then
    create role service_role nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname='anon') then
    create role anon nologin;
  end if;
end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb,
  created_at timestamptz default now()
);
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid
);
create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select case
    when strpos(name, '/') = 0 then array[]::text[]
    else string_to_array(regexp_replace(name, '/[^/]*$', ''), '/')
  end
$$;
`;

const files = fs
  .readdirSync(migDir)
  .filter((f) => /^\d{14}_.+\.sql$/.test(f))
  .sort();

const expectedMigrations = [
  "20260812000100_extensions_types.sql",
  "20260812000200_schema.sql",
  "20260812000300_relations.sql",
  "20260812000400_read_models.sql",
  "20260812000500_functions.sql",
  "20260812000600_triggers.sql",
  "20260812000700_storage.sql",
  "20260812000800_security_rls.sql",
  "20260812000900_comments.sql",
  "20260812001000_contract_checks.sql",
  "20260812001100_action_plan_deadline_change_requests.sql",
  "20260813000100_fami_preliminary_open_period_and_close.sql",
  "20260814000100_action_plan_monitoring_export_fields.sql",
  "20260819000100_repair_cycles_manual_fami_workspace.sql",
  "20260819120000_list_organization_respondents_profiles.sql",
  "20260820120000_action_plan_progress_monotonic.sql",
  "20260821190000_report_closure_emission_integrity.sql",
  "20260822190000_validation_draft_reads_cycle_state.sql",
  "20260824120000_optional_action_plan_execution_evidence.sql",
  "20260824143000_recommendation_status_optional_execution_evidence.sql",
  "20260826120000_bimonthly_tracking_and_prelim_v2.sql",
];
if (JSON.stringify(files) !== JSON.stringify(expectedMigrations)) {
  throw new Error(`Baseline oficial divergente: ${files.join(", ")}`);
}

const report = {
  appliedCount: 0,
  failures: [],
  assertions: [],
  verdict: "FAIL",
};

function assert(name, ok, detail = null) {
  report.assertions.push({ name, ok: Boolean(ok), detail });
  if (!ok) {
    throw new Error(`ASSERT_FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function ts(value) {
  if (value == null) return null;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(t) ? String(value) : t;
}

async function applyMigrations(db) {
  await db.exec(PREAMBLE);
  for (const name of files) {
    const sql = fs.readFileSync(path.join(migDir, name), "utf8");
    try {
      await db.exec(sql);
      report.appliedCount += 1;
    } catch (e) {
      report.failures.push({
        name,
        error: String(e.message || e).slice(0, 500),
      });
      throw e;
    }
  }
}

async function seedGraph(db) {
  const ids = {
    admin: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    respondent: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    org: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    form: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    formVersion: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    section: "ffffffff-ffff-ffff-ffff-ffffffffffff",
    questionA: "11111111-1111-1111-1111-111111111111",
    questionB: "22222222-2222-2222-2222-222222222222",
    qvA: "33333333-3333-3333-3333-333333333333",
    qvB: "44444444-4444-4444-4444-444444444444",
    cycleValidated: "55555555-5555-5555-5555-555555555555",
    cycleCompleted: "66666666-6666-6666-6666-666666666666",
    cycleOpen: "77777777-7777-7777-7777-777777777777",
    period2026: "b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1",
    period2025: "c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2",
    period2024: "d3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d3d3",
    processingValidated: "88888888-8888-8888-8888-888888888888",
    processingCompleted: "99999999-9999-9999-9999-999999999999",
    famiValidated: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  };

  await db.query(`select public.set_audit_actor($1::uuid)`, [ids.admin]);

  await db.exec(`
    insert into auth.users (id, email) values
      ('${ids.admin}', 'admin@test.local'),
      ('${ids.respondent}', 'resp@test.local');

    insert into public.organizations (id, name, acronym)
    values ('${ids.org}', 'Org Teste Gestao', 'OTG');

    insert into public.profiles (user_id, role, organization_id, full_name)
    values
      ('${ids.admin}', 'admin', null, 'Admin Teste'),
      ('${ids.respondent}', 'respondent', '${ids.org}', 'Respondente Teste');

    insert into public.forms (id, name, created_by)
    values ('${ids.form}', 'Formulario Gestao RPC', '${ids.admin}');

    insert into public.form_assignments (form_id, organization_id, assigned_by)
    values ('${ids.form}', '${ids.org}', '${ids.admin}');

    insert into public.axes (name) values
      ('Governanca'),
      ('Ambiental'),
      ('Social')
    on conflict (name) do nothing;

    insert into public.form_versions (id, form_id, version, state, published_by)
    values ('${ids.formVersion}', '${ids.form}', 1, 'published', '${ids.admin}');

    update public.forms
    set current_form_version_id = '${ids.formVersion}'
    where id = '${ids.form}';

    insert into public.sections (id, axis_id, code, name, ordem, status)
    select '${ids.section}', a.id, 'RPC-SEC-01', 'Secao RPC', 1, 'published'
    from public.axes a where a.name = 'Governanca' limit 1;

    insert into public.questions (id, section_id, prompt, evidence_parameter, fami_enabled)
    values
      ('${ids.questionA}', '${ids.section}', 'Criterio A', '{"required": false}'::jsonb, true),
      ('${ids.questionB}', '${ids.section}', 'Criterio B', '{"required": false}'::jsonb, true);

    insert into public.question_versions (
      id, question_id, version, prompt, evidence_parameter, fami_enabled,
      applies_to_respondent, section_id, section_name, section_order,
      axis_id, axis_name
    )
    select
      '${ids.qvA}', '${ids.questionA}', 1, 'Criterio A', '{"required": false}'::jsonb, true,
      true, s.id, s.name, s.ordem, s.axis_id, a.name
    from public.sections s
    join public.axes a on a.id = s.axis_id
    where s.id = '${ids.section}';

    insert into public.question_versions (
      id, question_id, version, prompt, evidence_parameter, fami_enabled,
      applies_to_respondent, section_id, section_name, section_order,
      axis_id, axis_name
    )
    select
      '${ids.qvB}', '${ids.questionB}', 1, 'Criterio B', '{"required": false}'::jsonb, true,
      true, s.id, s.name, s.ordem, s.axis_id, a.name
    from public.sections s
    join public.axes a on a.id = s.axis_id
    where s.id = '${ids.section}';

    insert into public.form_questions (form_version_id, question_version_id, order_index)
    values
      ('${ids.formVersion}', '${ids.qvA}', 0),
      ('${ids.formVersion}', '${ids.qvB}', 1);

    insert into public.form_periods (
      id, form_version_id, period_code, label, status
    ) values
      ('${ids.period2026}', '${ids.formVersion}', '2026', '2026', 'open'),
      ('${ids.period2025}', '${ids.formVersion}', '2025', '2025', 'open'),
      ('${ids.period2024}', '${ids.formVersion}', '2024', '2024', 'open');
  `);

  // Ciclo em coleta (prazo / pausa)
  await db.exec(`
    insert into public.cycles (
      id, form_version_id, organization_id, period_id, period_label, state,
      starts_at, response_deadline_at, original_response_deadline_at
    ) values (
      '${ids.cycleOpen}', '${ids.formVersion}', '${ids.org}', '${ids.period2026}', '2026',
      'in_response',
      now() - interval '10 days',
      now() + interval '20 days',
      now() + interval '20 days'
    );

    insert into public.cycle_processings (id, cycle_id, processing_version, status)
    values (gen_random_uuid(), '${ids.cycleOpen}', 1, 'working');
  `);

  // Ciclo validated com FAMI
  await db.exec(`
    insert into public.cycles (
      id, form_version_id, organization_id, period_id, period_label, state,
      starts_at, response_deadline_at, original_response_deadline_at,
      submitted_at, validated_at
    ) values (
      '${ids.cycleValidated}', '${ids.formVersion}', '${ids.org}', '${ids.period2025}', '2025',
      'validated',
      now() - interval '60 days',
      now() - interval '30 days',
      now() - interval '30 days',
      now() - interval '25 days',
      now() - interval '20 days'
    );

    insert into public.cycle_processings (
      id, cycle_id, processing_version, status, completed_at
    ) values (
      '${ids.processingValidated}', '${ids.cycleValidated}', 1, 'completed',
      now() - interval '20 days'
    );

    insert into public.fami_results (
      id, cycle_id, cycle_processing_id, scope_type, scope_id,
      points_obtained, points_possible, percentage, maturity_level
    ) values (
      '${ids.famiValidated}', '${ids.cycleValidated}', '${ids.processingValidated}',
      'global', null, 10, 20, 50.00, 3
    );
  `);

  // Ciclo completed (reabertura parcial)
  await db.exec(`
    insert into public.cycles (
      id, form_version_id, organization_id, period_id, period_label, state,
      starts_at, response_deadline_at, original_response_deadline_at,
      submitted_at, validated_at, closed_at,
      reference_start_year, reference_end_year, action_plan_revision
    ) values (
      '${ids.cycleCompleted}', '${ids.formVersion}', '${ids.org}', '${ids.period2024}', '2024',
      'completed',
      now() - interval '120 days',
      now() - interval '90 days',
      now() - interval '90 days',
      now() - interval '80 days',
      now() - interval '70 days',
      now() - interval '60 days',
      2024, 2024, 0
    );

    insert into public.cycle_processings (
      id, cycle_id, processing_version, status, completed_at
    ) values (
      '${ids.processingCompleted}', '${ids.cycleCompleted}', 1, 'completed',
      now() - interval '70 days'
    );

    insert into public.fami_results (
      cycle_id, cycle_processing_id, scope_type, scope_id,
      points_obtained, points_possible, percentage, maturity_level
    ) values (
      '${ids.cycleCompleted}', '${ids.processingCompleted}',
      'global', null, 15, 20, 75.00, 4
    );
  `);

  return ids;
}

async function runAssertions(db, ids) {
  // 1) Prazo excepcional: original preservado, deadline muda
  const newDeadline = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString();
  const before = await db.query(
    `select response_deadline_at, original_response_deadline_at, deadline_change_count
     from public.cycles where id = $1`,
    [ids.cycleOpen],
  );
  const original = before.rows[0].original_response_deadline_at;

  await db.query(
    `select public.admin_change_cycle_response_deadlines(
      ARRAY[$1::uuid], $2::timestamptz, 'change_deadline', 'single',
      'Prorrogacao individual para orgao em teste de integracao.',
      $3::uuid, gen_random_uuid()
    )`,
    [ids.cycleOpen, newDeadline, ids.admin],
  );

  const afterDeadline = await db.query(
    `select response_deadline_at, original_response_deadline_at, deadline_change_count
     from public.cycles where id = $1`,
    [ids.cycleOpen],
  );
  assert(
    "original_deadline_preserved",
    ts(afterDeadline.rows[0].original_response_deadline_at) === ts(original),
    String(afterDeadline.rows[0].original_response_deadline_at),
  );
  assert(
    "response_deadline_changed",
    ts(afterDeadline.rows[0].response_deadline_at) !== ts(original),
  );
  assert(
    "deadline_change_count_incremented",
    Number(afterDeadline.rows[0].deadline_change_count) >= 1,
  );

  // 2) Pausa bloqueia edição de critério
  await db.query(
    `select public.admin_set_cycle_collection_pause(
      ARRAY[$1::uuid], true, 'single',
      'Suspensao temporaria da coleta para teste de integracao.',
      $2::uuid, gen_random_uuid()
    )`,
    [ids.cycleOpen, ids.admin],
  );
  const pausedEditable = await db.query(
    `select app_private.is_cycle_question_collection_editable($1::uuid, $2::uuid) as ok`,
    [ids.cycleOpen, ids.qvA],
  );
  assert("paused_blocks_question_edit", pausedEditable.rows[0].ok === false);

  await db.query(
    `select public.admin_set_cycle_collection_pause(
      ARRAY[$1::uuid], false, 'single',
      'Retomada da coleta apos teste de suspensao administrativa.',
      $2::uuid, gen_random_uuid()
    )`,
    [ids.cycleOpen, ids.admin],
  );

  // 3) Reabrir validação preserva FAMI e cria processing working
  const famiBefore = await db.query(
    `select count(*)::int as n from public.fami_results where cycle_id = $1`,
    [ids.cycleValidated],
  );
  assert("fami_exists_before_validation_reopen", famiBefore.rows[0].n === 1);

  await db.query(
    `select public.reopen_validation_cycle(
      $1::uuid, $2::uuid,
      'Reabertura de validacao para nova rodada sem apagar FAMI.'
    )`,
    [ids.cycleValidated, ids.admin],
  );

  const cycleAfterVal = await db.query(
    `select state, validated_at from public.cycles where id = $1`,
    [ids.cycleValidated],
  );
  assert("validation_reopen_state", cycleAfterVal.rows[0].state === "in_validation");
  assert("validation_reopen_clears_validated_at", cycleAfterVal.rows[0].validated_at === null);

  const famiAfter = await db.query(
    `select id, percentage, maturity_level, cycle_processing_id
     from public.fami_results where cycle_id = $1`,
    [ids.cycleValidated],
  );
  assert("fami_preserved_after_validation_reopen", famiAfter.rows.length === 1);
  assert(
    "fami_values_unchanged",
    Number(famiAfter.rows[0].percentage) === 50 &&
      Number(famiAfter.rows[0].maturity_level) === 3,
  );
  assert(
    "fami_still_points_to_previous_processing",
    String(famiAfter.rows[0].cycle_processing_id) === ids.processingValidated,
  );

  const working = await db.query(
    `select count(*)::int as n from public.cycle_processings
     where cycle_id = $1 and status = 'working'`,
    [ids.cycleValidated],
  );
  assert("working_processing_created", working.rows[0].n === 1);

  // 4) Reabertura de ciclo concluído exige relatório oficial preservado
  const reopenDeadline = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
  let reopenBlockedWithoutReport = false;
  try {
    await db.query(
      `select public.reopen_cycle(
        $1::uuid, $2::uuid,
        'Reabertura parcial apenas do criterio A no ciclo concluido.',
        $3::timestamptz,
        ARRAY[$4::uuid]
      )`,
      [ids.cycleCompleted, ids.admin, reopenDeadline, ids.qvA],
    );
  } catch (error) {
    reopenBlockedWithoutReport = /reopen_requires_official_report/i.test(
      String(error.message || error),
    );
    if (!reopenBlockedWithoutReport) throw error;
  }
  assert(
    "reopen_completed_requires_official_report",
    reopenBlockedWithoutReport,
  );

  await db.exec(`
    insert into public.reports (
      cycle_id, cycle_processing_id, file_path, generated_by,
      status, file_sha256, content_sha256, file_size_bytes,
      action_plan_revision, reference_start_year, reference_end_year
    ) values (
      '${ids.cycleCompleted}', '${ids.processingCompleted}',
      'reports/pglite-completed-official.pdf', '${ids.admin}',
      'completed',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      2048, 0, 2024, 2024
    );
  `);

  // 5) Reabertura parcial: só critério A editável
  await db.query(
    `select public.reopen_cycle(
      $1::uuid, $2::uuid,
      'Reabertura parcial apenas do criterio A no ciclo concluido.',
      $3::timestamptz,
      ARRAY[$4::uuid]
    )`,
    [ids.cycleCompleted, ids.admin, reopenDeadline, ids.qvA],
  );

  const completedState = await db.query(
    `select state, reopen_count from public.cycles where id = $1`,
    [ids.cycleCompleted],
  );
  assert("partial_reopen_state", completedState.rows[0].state === "in_response");
  assert("partial_reopen_count", Number(completedState.rows[0].reopen_count) === 1);

  const editableA = await db.query(
    `select app_private.is_cycle_question_collection_editable($1::uuid, $2::uuid) as ok`,
    [ids.cycleCompleted, ids.qvA],
  );
  const editableB = await db.query(
    `select app_private.is_cycle_question_collection_editable($1::uuid, $2::uuid) as ok`,
    [ids.cycleCompleted, ids.qvB],
  );
  assert("partial_scope_allows_selected", editableA.rows[0].ok === true);
  assert("partial_scope_blocks_other", editableB.rows[0].ok === false);

  const famiCompleted = await db.query(
    `select count(*)::int as n from public.fami_results where cycle_id = $1`,
    [ids.cycleCompleted],
  );
  assert(
    "fami_preserved_after_response_reopen",
    famiCompleted.rows[0].n === 1,
  );
}

async function main() {
  console.log(`PGlite form-management RPC: ${files.length} migrations…`);
  const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });

  try {
    await applyMigrations(db);
    console.log(`✓ migrations aplicadas (${report.appliedCount})`);
    const ids = await seedGraph(db);
    console.log("✓ grafo mínimo semeado");
    await runAssertions(db, ids);
    report.verdict = "PASS_FORM_MANAGEMENT_RPC";
    console.log(`✓ ${report.assertions.length} asserções OK`);
  } catch (e) {
    report.verdict = "FAIL";
    report.error = String(e.message || e).slice(0, 800);
    console.error("✗", report.error);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Relatório: ${reportPath}`);
}

main();
