import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import "server-only";

import { createReadStream } from "node:fs";
import { rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mapConcurrent } from "@/shared/async/map-concurrent";
import { StoredZipFileWriter } from "@/application/automation/zip-file-writer";
import { loadOfficialReportData } from "@/features/reports/pdf/build-official-report-data";
import { CycleClosureService } from "@/application/reporting/cycle-closure-service";
import { REPORTS_BUCKET } from "@/features/reports/pdf/report-file-path";
import { createSupabaseServiceRoleClient, type TypedSupabaseClient } from "@/infrastructure/supabase/server";

const REPORT_JOB_KIND = "report_bundle";
const REPORT_BUNDLE_CONCURRENCY = 1;

type PermanentReportFailureCode =
  | "missing_actor"
  | "official_fami_unavailable"
  | "cycle_not_completed"
  | "no_eligible_reports";

class PermanentReportFailure extends Error {
  constructor(
    readonly code: PermanentReportFailureCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PermanentReportFailure";
  }
}

type QueryResult = PromiseLike<{ error: { message?: string } | null }>;

async function assertWrite(query: QueryResult): Promise<void> {
  const { error } = await query;
  if (error) throw error;
}

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

async function deleteJobOrThrow(client: TypedSupabaseClient, jobId: string) {
  const { error } = await client.from("automation_jobs").delete().eq("id", jobId);
  if (error) throw new Error(`report_job_compensation_failed:${error.message}`);
}

export async function queueReportBundle(input: { cycleIds: string[]; actorUserId: string }) {
  const cycleIds = Array.from(new Set(input.cycleIds));
  if (cycleIds.length === 0) throw new Error("Selecione ao menos um diagnóstico.");
  if (cycleIds.length > 50) throw new Error("Cada pacote aceita no máximo 50 relatórios.");

  const client = createSupabaseServiceRoleClient();
  const { data: job, error: jobError } = await client
    .from("automation_jobs")
    .insert({
      kind: REPORT_JOB_KIND,
      status: "pending",
      requested_by: input.actorUserId,
      scheduled_for: new Date().toISOString(),
      max_attempts: 5,
      payload: { cycle_ids: cycleIds },
    })
    .select("id")
    .single();
  if (jobError || !job) throw jobError ?? new Error("Não foi possível enfileirar o pacote.");
  const jobId = String(job.id);

  const { error: itemsError } = await client.from("automation_job_items").insert(
    cycleIds.map((cycleId) => ({
      job_id: jobId,
      entity_type: "cycle_report",
      entity_id: cycleId,
      idempotency_key: `cycle-report:${cycleId}`,
      status: "pending",
      input: { cycle_id: cycleId },
    })),
  );
  if (itemsError) {
    await deleteJobOrThrow(client, jobId);
    throw itemsError;
  }

  return { jobId, status: "pending" as const, total: cycleIds.length };
}

async function latestPreservedReport(
  client: TypedSupabaseClient,
  cycleProcessingId: string,
) {
  const { data: existing, error } = await client
    .from("reports")
    .select("file_path,emission_version")
    .eq("cycle_processing_id", cycleProcessingId)
    .in("status", ["completed", "legacy"])
    .order("emission_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return existing;
}

async function reportBytes(cycleId: string, actorUserId: string) {
  const client = createSupabaseServiceRoleClient();
  const data = await loadOfficialReportData({ cycleId }, client);
  if (!data) {
    throw new PermanentReportFailure(
      "official_fami_unavailable",
      "O diagnóstico ainda não possui FAMI oficial para emissão.",
    );
  }

  let existing = await latestPreservedReport(client, data.cycleProcessingId);
  if (!existing?.file_path) {
    const emission = await new CycleClosureService(client).ensureClosedCycleReport(
      cycleId,
      actorUserId,
    );
    if (emission.status === "emission_failed") {
      throw new Error(
        emission.message ?? "Falha ao emitir o relatório oficial antes de montar o pacote.",
      );
    }
    if (emission.status === "emitting") {
      throw new Error("A emissão oficial ainda está em andamento. Tente montar o pacote novamente.");
    }
    existing = await latestPreservedReport(client, data.cycleProcessingId);
  }

  if (!existing?.file_path) {
    throw new Error("A emissão oficial foi concluída sem disponibilizar um arquivo preservado.");
  }

  const { data: downloaded, error: downloadError } = await client.storage
    .from(REPORTS_BUCKET)
    .download(String(existing.file_path));
  if (downloadError || !downloaded) {
    throw downloadError ?? new Error("Arquivo oficial não encontrado no armazenamento.");
  }

  const bytes = new Uint8Array(await downloaded.arrayBuffer());
  const emissionVersion = Number(existing.emission_version);
  const shortCycleId = data.cycleId.replaceAll("-", "").slice(0, 10);
  return {
    bytes,
    fileName:
      [
        safeFileName(data.organizationName),
        safeFileName(data.formName),
        safeFileName(data.periodLabel),
        `proc-${data.processingVersion}`,
        `emissao-${emissionVersion}`,
        shortCycleId,
      ].join("-") + ".pdf",
  };
}

function isPermanentReportFailure(error: unknown): boolean {
  return (
    error instanceof PermanentReportFailure ||
    hasDatabaseErrorCode(error, "cycle_not_completed")
  );
}

async function markUnresolvedItems(
  client: TypedSupabaseClient,
  jobId: string,
  exhausted: boolean,
  message: string,
) {
  await assertWrite(
    client
      .from("automation_job_items")
      .update({
        status: exhausted ? "failed" : "pending",
        message: exhausted ? message : null,
        output: {},
      })
      .eq("job_id", jobId)
      .in("status", ["pending", "processing"]),
  );
}

export async function processQueuedReportBundles() {
  const client = createSupabaseServiceRoleClient();
  const workerId = `report-bundles:${randomUUID()}`;
  const { data: jobs, error } = await client.rpc("claim_automation_jobs", {
    p_worker_id: workerId,
    p_kinds: [REPORT_JOB_KIND],
    p_limit: 1,
    p_lock_timeout: "30 minutes",
  });
  if (error) throw error;

  return mapConcurrent(jobs ?? [], REPORT_BUNDLE_CONCURRENCY, async (job) => {
    const startedAtMs = Date.now();
    const jobId = String(job.id);
    const actorUserId = job.requested_by ? String(job.requested_by) : "";
    const filePath = join(tmpdir(), `orienta-report-bundle-${jobId}.zip`);
    let writer: StoredZipFileWriter | null = null;

    try {
      if (!actorUserId) {
        throw new PermanentReportFailure(
          "missing_actor",
          "O pacote não possui administrador responsável.",
        );
      }
      await assertWrite(
        client
          .from("automation_job_items")
          .update({ status: "pending", message: null, output: {} })
          .eq("job_id", jobId),
      );

      const { data: items, error: itemError } = await client
        .from("automation_job_items")
        .select("id,entity_id")
        .eq("job_id", jobId)
        .eq("entity_type", "cycle_report")
        .order("created_at", { ascending: true });
      if (itemError) throw itemError;

      writer = await StoredZipFileWriter.create(filePath);
      const results: Array<{
        cycleId: string;
        status: "succeeded" | "failed";
        message: string;
        permanentFailure?: boolean;
      }> = [];
      let succeeded = 0;

      for (const item of items ?? []) {
        const cycleId = String(item.entity_id);
        await assertWrite(client.from("automation_job_items").update({ status: "processing" }).eq("id", item.id));
        try {
          const report = await reportBytes(cycleId, actorUserId);
          await writer.add(report.fileName, report.bytes);
          results.push({ cycleId, status: "succeeded", message: "Relatório incluído no pacote." });
          succeeded += 1;
          await assertWrite(
            client.from("automation_job_items").update({
              status: "succeeded",
              message: "Relatório incluído no pacote.",
              output: { file_name: report.fileName },
            }).eq("id", item.id),
          );
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : "Falha não identificada.";
          results.push({
            cycleId,
            status: "failed",
            message,
            permanentFailure: isPermanentReportFailure(caught),
          });
          await assertWrite(
            client.from("automation_job_items").update({ status: "failed", message, output: {} }).eq("id", item.id),
          );
        }
      }

      if (succeeded === 0) {
        const allFailuresArePermanent =
          results.length > 0 && results.every((result) => result.permanentFailure === true);
        if (allFailuresArePermanent) {
          throw new PermanentReportFailure(
            "no_eligible_reports",
            "Nenhum relatório elegível pôde ser gerado.",
          );
        }
        throw new Error("Nenhum relatório pôde ser gerado por uma falha temporária.");
      }
      await writer.add(
        "manifesto.json",
        new TextEncoder().encode(JSON.stringify({ generatedAt: new Date().toISOString(), jobId, results }, null, 2)),
      );
      await writer.finalize();
      await writer.close();
      writer = null;

      const bundlePath = `bundles/${jobId}.zip`;
      const { error: uploadError } = await client.storage
        .from(REPORTS_BUCKET)
        .upload(bundlePath, createReadStream(filePath), { contentType: "application/zip", upsert: true });
      if (uploadError) throw uploadError;

      const failed = results.length - succeeded;
      const status = failed === 0 ? "completed" : "completed_with_errors";
      const fileName = `relatorios-orienta-${new Date().toISOString().slice(0, 10)}-${jobId.slice(0, 8)}.zip`;
      await assertWrite(
        client.from("automation_jobs").update({
          status,
          completed_at: new Date().toISOString(),
          result_summary: { total: results.length, succeeded, failed, bundle_path: bundlePath, file_name: fileName },
          error_message: null,
          locked_at: null,
          locked_by: null,
          last_duration_ms: Date.now() - startedAtMs,
        }).eq("id", jobId),
      );
      return { jobId, status, total: results.length, succeeded, failed };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Falha não identificada.";
      const exhausted =
        Number(job.attempts) >= Number(job.max_attempts) || isPermanentReportFailure(caught);
      await markUnresolvedItems(client, jobId, exhausted, message);
      await assertWrite(
        client.from("automation_jobs").update({
          status: exhausted ? "failed" : "pending",
          scheduled_for: exhausted ? job.scheduled_for : new Date(Date.now() + 5 * 60_000).toISOString(),
          completed_at: exhausted ? new Date().toISOString() : null,
          started_at: exhausted ? job.started_at : null,
          error_message: message,
          locked_at: null,
          locked_by: null,
          last_duration_ms: Date.now() - startedAtMs,
        }).eq("id", jobId),
      );
      return { jobId, status: exhausted ? ("failed" as const) : ("pending" as const), message };
    } finally {
      if (writer) await writer.close().catch(() => undefined);
      await rm(filePath, { force: true }).catch(() => undefined);
    }
  });
}

export async function createReportBundleDownload(jobId: string) {
  const client = createSupabaseServiceRoleClient();
  const { data: job, error } = await client
    .from("automation_jobs")
    .select("status,result_summary")
    .eq("id", jobId)
    .eq("kind", REPORT_JOB_KIND)
    .maybeSingle();
  if (error) throw error;
  if (!job) return null;
  if (!["completed", "completed_with_errors"].includes(String(job.status))) {
    throw new Error("O pacote ainda não está disponível para download.");
  }
  const summary = job.result_summary && typeof job.result_summary === "object" && !Array.isArray(job.result_summary)
    ? job.result_summary
    : {};
  const bundlePath = typeof summary.bundle_path === "string" ? summary.bundle_path : "";
  if (!bundlePath) throw new Error("O pacote concluído não possui arquivo persistido.");
  const { data, error: signedError } = await client.storage
    .from(REPORTS_BUCKET)
    .createSignedUrl(bundlePath, 60, { download: true });
  if (signedError || !data?.signedUrl) throw signedError ?? new Error("Não foi possível assinar o download.");
  return {
    url: data.signedUrl,
    fileName: typeof summary.file_name === "string" ? summary.file_name : "relatorios-orienta.zip",
  };
}
