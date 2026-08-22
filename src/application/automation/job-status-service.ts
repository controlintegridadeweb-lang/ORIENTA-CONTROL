import "server-only";

import type { ImportRowResult } from "@/application/automation/import-service";
import type { Json } from "@/infrastructure/supabase/database.types";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";

function objectValue(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export async function getAutomationJobStatus(jobId: string) {
  const client = createSupabaseServiceRoleClient();
  const { data: job, error } = await client
    .from("automation_jobs")
    .select("id,kind,status,result_summary,error_message,created_at,started_at,completed_at")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  if (!job) return null;

  const items: Array<{ entity_id: string; status: string; message: string | null; output: Json }> = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data: page, error: itemError } = await client
      .from("automation_job_items")
      .select("entity_id,status,message,output")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (itemError) throw itemError;
    items.push(...(page ?? []));
    if (!page || page.length < pageSize) break;
  }

  const results: ImportRowResult[] = items
    .filter((item) => String(item.entity_id).match(/^\d+$/))
    .map((item) => {
      const output = objectValue(item.output);
      const status = String(item.status);
      const importStatus: ImportRowResult["status"] =
        status === "succeeded"
          ? "created"
          : status === "skipped"
            ? "skipped"
            : status === "failed"
              ? "failed"
              : "valid";
      return {
        row: Number(item.entity_id),
        status: importStatus,
        identity: String(output.identity ?? `Linha ${item.entity_id}`),
        message: item.message ?? (status === "pending" ? "Aguardando processamento." : "Em processamento."),
      };
    })
    .sort((left, right) => left.row - right.row);

  return {
    id: String(job.id),
    kind: String(job.kind),
    status: String(job.status),
    summary: objectValue(job.result_summary),
    errorMessage: job.error_message,
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    results,
  };
}
