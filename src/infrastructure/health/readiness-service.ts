import "server-only";
import { collectProductionConfigurationIssues } from "@/infrastructure/config/production-configuration";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";

export type ReadinessCheck = {
  name: "configuration" | "database" | "authentication" | "storage" | "upload_storage";
  status: "pass" | "fail";
  durationMs: number;
};
const CHECK_TIMEOUT_MS = 6_000;
async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("readiness_timeout")), timeoutMs); })]);
  } finally { if (timeout) clearTimeout(timeout); }
}
async function executeCheck(name: ReadinessCheck["name"], operation: () => Promise<void> | void): Promise<ReadinessCheck> {
  const startedAt = performance.now();
  try {
    await withTimeout(Promise.resolve().then(operation), CHECK_TIMEOUT_MS);
    return { name, status: "pass", durationMs: Math.max(0, Math.round(performance.now() - startedAt)) };
  } catch {
    return { name, status: "fail", durationMs: Math.max(0, Math.round(performance.now() - startedAt)) };
  }
}
async function checkDatabase(): Promise<void> {
  const client = createSupabaseServiceRoleClient();
  const results = await Promise.all([
    client.from("organizations").select("id", { head: true }).limit(1),
    client.from("cycles").select("id,reference_start_year,response_collection_paused_at,validation_deadline_at,action_plan_revision", { head: true }).limit(1),
    client.from("automation_jobs").select("id,last_duration_ms,max_attempts,executed_by_system", { head: true }).limit(1),
    client.from("audit_logs").select("id,event_type,created_at", { head: true }).limit(1),
    client.from("action_plan_documents").select("id,file_validation_status,created_at", { head: true }).limit(1),
    client.from("pending_action_plan_document_uploads").select("id,expires_at,storage_path", { head: true }).limit(1),
    client.from("action_plan_storage_cleanup_queue").select("storage_path,scheduled_for", { head: true }).limit(1),
  ]);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}
async function checkAuthentication(): Promise<void> {
  const { error } = await createSupabaseServiceRoleClient().auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) throw error;
}
async function checkStorage(): Promise<void> {
  const client = createSupabaseServiceRoleClient();
  for (const bucketId of ["evidencias", "planos-acao", "relatorios"] as const) {
    const { data, error } = await client.storage.getBucket(bucketId);
    if (error || !data || data.public) throw error ?? new Error("storage_bucket_not_private");
    if (bucketId !== "relatorios" && data.file_size_limit !== 20 * 1024 * 1024) {
      throw new Error(`${bucketId}_bucket_size_limit_invalid`);
    }
  }
}
async function checkUploadStorage(): Promise<void> {
  const client = createSupabaseServiceRoleClient();
  for (const bucketId of ["evidencias", "planos-acao"] as const) {
    const { data, error } = await client.storage.getBucket(bucketId);
    if (error || !data || data.public) throw error ?? new Error("upload_bucket_not_private");
    if (data.file_size_limit !== 20 * 1024 * 1024) {
      throw new Error(`${bucketId}_bucket_size_limit_invalid`);
    }
    const { error: signedUrlError } = await client.storage
      .from(bucketId)
      .createSignedUrl("_readiness_probe/nonexistent", 10);
    if (
      signedUrlError
      && !/not found|invalid|object|does not exist|404/i.test(signedUrlError.message)
    ) {
      throw signedUrlError;
    }
  }
  const queueResults = await Promise.all([
    client.from("evidence_storage_cleanup_queue").select("storage_path", { head: true }).limit(1),
    client.from("pending_evidence_uploads").select("id", { head: true }).limit(1),
    client.from("pending_action_plan_document_uploads").select("id", { head: true }).limit(1),
    client.from("action_plan_storage_cleanup_queue").select("storage_path", { head: true }).limit(1),
  ]);
  const failed = queueResults.find((result) => result.error);
  if (failed?.error) throw failed.error;
}
function checkConfiguration(): void {
  if (collectProductionConfigurationIssues().length > 0) throw new Error("production_configuration_invalid");
}
export async function evaluateReadiness(): Promise<{ ready: boolean; checks: ReadinessCheck[] }> {
  const checks = await Promise.all([
    executeCheck("configuration", checkConfiguration), executeCheck("database", checkDatabase),
    executeCheck("authentication", checkAuthentication), executeCheck("storage", checkStorage),
    executeCheck("upload_storage", checkUploadStorage),
  ]);
  return { ready: checks.every((check) => check.status === "pass"), checks };
}
