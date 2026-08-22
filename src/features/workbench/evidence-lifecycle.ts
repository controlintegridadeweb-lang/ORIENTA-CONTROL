import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/infrastructure/observability/logger";

const EVIDENCE_BUCKET = "evidencias";

type RetiredEvidenceRow = {
  id: string;
  storage_path: string | null;
};

/**
 * Remove evidências que já foram desativadas e ainda não pertencem a nenhum
 * snapshot histórico. A desativação lógica é feita pela trigger do banco na
 * mesma transação da resposta; esta função só executa a limpeza física segura.
 *
 * O retorno sinaliza pendência de limpeza sem reativar evidência incompatível
 * com a resposta atual. Assim, uma falha no Storage jamais mantém uma
 * evidência ativa depois de “Não” ou “Não se aplica”.
 */
export async function purgeRetiredUnsnapshottedEvidence(
  supabase: SupabaseClient,
  responseId: string,
): Promise<{ cleanupPending: boolean }> {
  try {
    const { data, error } = await supabase
      .from("evidences")
      .select("id, storage_path")
      .eq("response_id", responseId)
      .not("deactivated_at", "is", null);
    if (error) throw error;

    let cleanupPending = false;
    for (const raw of (data ?? []) as RetiredEvidenceRow[]) {
      const { count, error: snapshotError } = await supabase
        .from("evidence_snapshots")
        .select("id", { count: "exact", head: true })
        .eq("evidence_id", raw.id);
      if (snapshotError) throw snapshotError;
      if ((count ?? 0) > 0) continue;

      if (raw.storage_path) {
        const { error: enqueueError } = await supabase
          .from("evidence_storage_cleanup_queue")
          .upsert(
            { storage_path: raw.storage_path, scheduled_for: new Date().toISOString() },
            { onConflict: "storage_path", ignoreDuplicates: true },
          );
        if (enqueueError) throw enqueueError;

        const { error: storageError } = await supabase.storage
          .from(EVIDENCE_BUCKET)
          .remove([raw.storage_path]);
        if (storageError) {
          cleanupPending = true;
          logError("Failed to purge retired evidence file", storageError, {
            responseId,
            evidenceId: raw.id,
          });
          continue;
        }
      }

      const { error: deleteError } = await supabase
        .from("evidences")
        .delete()
        .eq("id", raw.id)
        .not("deactivated_at", "is", null);
      if (deleteError) {
        cleanupPending = true;
        logError("Failed to purge retired evidence record", deleteError, {
          responseId,
          evidenceId: raw.id,
        });
      } else if (raw.storage_path) {
        const { error: acknowledgeError } = await supabase
          .from("evidence_storage_cleanup_queue")
          .delete()
          .eq("storage_path", raw.storage_path);
        if (acknowledgeError) {
          cleanupPending = true;
          logError("Failed to acknowledge retired evidence cleanup", acknowledgeError, {
            responseId,
            evidenceId: raw.id,
          });
        }
      }
    }
    return { cleanupPending };
  } catch (error) {
    // A resposta já foi salva e a trigger do banco já garantiu a desativação.
    // Falhas posteriores de limpeza não podem transformar uma operação válida
    // em erro para a pessoa respondente.
    logError("Failed to reconcile retired evidence", error, { responseId });
    return { cleanupPending: true };
  }
}
