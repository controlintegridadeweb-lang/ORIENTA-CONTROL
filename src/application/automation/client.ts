import { z } from "zod";
import { apiResponseSchema, buildHeaders, formatError, parseJson } from "@/infrastructure/api/fetch-client";
import { objectContract, unknownRecordSchema } from "@/infrastructure/api/contract-schema";
import type { LifecycleBatchAction, LifecycleBatchResult } from "@/application/automation/batch-lifecycle-service";
import type { ImportKind, ImportRowResult } from "@/application/automation/import-service";


const importRowResultSchema = objectContract<ImportRowResult>("resultado de importação", {
  row: "number",
  status: "string",
  identity: "string",
  message: "string",
});

const lifecycleBatchItemSchema = objectContract<LifecycleBatchResult["succeeded"][number]>(
  "item de lote do ciclo",
  { cycleId: "string", status: "string", fromState: "nullable-string", toState: "nullable-string", message: "string" },
);

const lifecycleBatchResultSchema = apiResponseSchema({
  jobId: z.string(),
  action: z.enum(["open_cycle", "finalize_validation", "close_cycle"]),
  total: z.number().int().nonnegative(),
  succeeded: z.array(lifecycleBatchItemSchema),
  skipped: z.array(lifecycleBatchItemSchema),
  failed: z.array(lifecycleBatchItemSchema),
});

const queuedJobSchema = apiResponseSchema({ jobId: z.string().optional() });
const reportDownloadSchema = apiResponseSchema({
  url: z.string().url().optional(),
  fileName: z.string().optional(),
});
const automationJobSchema = apiResponseSchema({
  id: z.string(),
  kind: z.string(),
  status: z.string(),
  summary: unknownRecordSchema,
  errorMessage: z.string().nullable(),
  results: z.array(importRowResultSchema),
});
const importResultSchema = apiResponseSchema({
  jobId: z.string().optional(),
  status: z.string().optional(),
  results: z.array(importRowResultSchema).optional(),
  total: z.number().int().nonnegative().optional(),
  validCount: z.number().int().nonnegative().optional(),
});
export type AutomationJobStatus = {
  id: string;
  kind: string;
  status: string;
  summary: Record<string, unknown>;
  errorMessage: string | null;
  results: ImportRowResult[];
};

export async function runCycleLifecycleBatch(action: LifecycleBatchAction, cycleIds: string[]): Promise<LifecycleBatchResult> {
  const response = await fetch("/api/admin/automation/cycles", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ action, cycleIds }),
  });
  const body = await parseJson(response, lifecycleBatchResultSchema);
  if (!response.ok) throw new Error(formatError(body));
  return body;
}

export async function downloadReportBundle(cycleIds: string[]): Promise<void> {
  const response = await fetch("/api/admin/automation/reports", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ cycleIds }),
  });
  const queued = await parseJson(response, queuedJobSchema);
  if (!response.ok || !queued.jobId) throw new Error(formatError(queued));

  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    const job = await getAutomationJob(queued.jobId);
    if (["completed", "completed_with_errors"].includes(job.status)) {
      const downloadResponse = await fetch(
        `/api/admin/automation/jobs/${encodeURIComponent(queued.jobId)}/download`,
        { headers: buildHeaders(), cache: "no-store" },
      );
      const download = await parseJson(downloadResponse, reportDownloadSchema);
      if (!downloadResponse.ok || !download.url) throw new Error(formatError(download));
      const anchor = document.createElement("a");
      anchor.href = download.url;
      anchor.download = download.fileName ?? "relatorios-orienta.zip";
      anchor.rel = "noopener";
      anchor.click();
      return;
    }
    if (["failed", "cancelled"].includes(job.status)) {
      throw new Error(job.errorMessage ?? "O pacote de relatórios não pôde ser gerado.");
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("O pacote continua em processamento. Consulte novamente em alguns instantes.");
}

export async function getAutomationJob(jobId: string): Promise<AutomationJobStatus> {
  const response = await fetch(`/api/admin/automation/jobs/${encodeURIComponent(jobId)}`, {
    headers: buildHeaders(),
    cache: "no-store",
  });
  const body = await parseJson(response, automationJobSchema);
  if (!response.ok) throw new Error(formatError(body));
  return body;
}

export async function importCsv(input: { kind: ImportKind; mode: "preview" | "commit"; csv: string }): Promise<{
  jobId?: string;
  status?: string;
  results: ImportRowResult[];
  total: number;
  validCount?: number;
}> {
  const response = await fetch("/api/admin/automation/import", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(input),
  });
  const body = await parseJson(response, importResultSchema);
  if (!response.ok || !body.results) throw new Error(formatError(body));
  return {
    jobId: body.jobId,
    status: body.status,
    results: body.results,
    total: Number(body.total ?? body.results.length),
    validCount: body.validCount,
  };
}
