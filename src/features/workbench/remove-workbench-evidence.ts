import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { adminProofStatusSchema } from "@/shared/domain/admin-proof-status";
import { isRespondentCollectionEditable } from "@/shared/domain/workflow";
import { cycleStateLabelOrFallback } from "@/shared/domain/cycle-labels";
import { CycleStateService } from "@/features/cycles/server";
import { resolveQuestionVersionId } from "@/features/workbench/resolve-question-version";
import { logError } from "@/infrastructure/observability/logger";

const BUCKET = "evidencias";

export type RemoveWorkbenchEvidenceInput = {
  cycleId: string;
  organizationId: string;
  actorUserId: string;
  questionId: string;
  evidenceId?: string;
  expectedRevision: number;
};

const responseWithQuestionSchema = z.object({
  id: z.string().uuid(),
  answer: z.enum(["yes", "no", "not_applicable"]),
  is_not_applicable: z.boolean(),
  revision: z.number().int().positive(),
  admin_proof_status: adminProofStatusSchema.nullable().optional(),
});

const activeEvidenceSchema = z.object({
  id: z.string().uuid(),
  validation_status: z.string(),
});

const removeMutationResultSchema = z.object({
  responseId: z.string().uuid(),
  evidenceId: z.string().uuid(),
  storagePath: z.string().nullable(),
  deactivated: z.boolean(),
  responseRevision: z.number().int().positive(),
});

/**
 * Remove uma evidência em uma RPC atômica. O Storage é limpo somente depois
 * do commit; uma falha nessa limpeza deixa apenas um objeto órfão para limpeza.
 */
export async function removeWorkbenchEvidence(
  supabase: SupabaseClient,
  input: RemoveWorkbenchEvidenceInput,
): Promise<
  | {
      ok: true;
      cycleId: string;
      cleanupPending: boolean;
    }
  | { ok: false; status: number; error: string }
> {
  const {
    cycleId,
    organizationId,
    actorUserId,
    questionId,
    evidenceId,
    expectedRevision,
  } = input;

  const cycle = await new CycleStateService(supabase).find(cycleId);
  if (!cycle) {
    return { ok: false, status: 404, error: "Diagnóstico não encontrado." };
  }
  if (cycle.organizationId !== organizationId) {
    return {
      ok: false,
      status: 403,
      error: "Diagnóstico fora do escopo da organização autorizada.",
    };
  }
  if (!isRespondentCollectionEditable(cycle.state, cycle.responseCollectionPausedAt)) {
    return {
      ok: false,
      status: 409,
      error: cycle.responseCollectionPausedAt
        ? "A coleta deste diagnóstico está temporariamente suspensa pela administração."
        : "As evidências estão bloqueadas nesta etapa do diagnóstico: " +
          `${cycleStateLabelOrFallback(cycle.state)}.`,
    };
  }

  const questionVersionId = await resolveQuestionVersionId(
    supabase,
    cycle.formVersionId,
    questionId,
  );
  if (!questionVersionId) {
    return { ok: false, status: 400, error: "Pergunta não pertence a este formulário." };
  }

  const { data: responseData, error: responseError } = await supabase
    .from("responses")
    .select("id, answer, is_not_applicable, revision, admin_proof_status")
    .eq("cycle_id", cycle.id)
    .eq("question_version_id", questionVersionId)
    .maybeSingle();
  if (responseError) throw responseError;
  const response = responseData ? responseWithQuestionSchema.parse(responseData) : null;

  if (response) {
    if (cycle.state === "awaiting_adjustment") {
      const { data: activeRows, error: activeRowsError } = await supabase
        .from("evidences")
        .select("validation_status")
        .eq("response_id", response.id)
        .is("deactivated_at", null);
      if (activeRowsError) throw activeRowsError;
      const hasAdjustmentRequest = (activeRows ?? []).some(
        (item) => item.validation_status === "adjustment_requested",
      );
      const proofRequested = response.admin_proof_status === "proof_requested";
      if (!hasAdjustmentRequest && !proofRequested) {
        return {
          ok: false,
          status: 409,
          error: "Esta pergunta não foi devolvida para correção.",
        };
      }
    }

    let evidenceQuery = supabase
      .from("evidences")
      .select("id, validation_status")
      .eq("response_id", response.id)
      .is("deactivated_at", null);
    evidenceQuery = evidenceId
      ? evidenceQuery.eq("id", evidenceId)
      : evidenceQuery.order("submitted_at", { ascending: false }).limit(1);
    const { data: evidenceRows, error: evidenceError } = await evidenceQuery;
    if (evidenceError) throw evidenceError;
    const evidenceData = evidenceRows?.[0];

    if (evidenceData) {
      const activeEvidence = activeEvidenceSchema.parse(evidenceData);
      if (
        cycle.state === "awaiting_adjustment" &&
        activeEvidence.validation_status !== "pending"
      ) {
        return {
          ok: false,
          status: 409,
          error: "A evidência devolvida deve ser preservada no histórico. Envie uma nova versão para substituí-la.",
        };
      }
      const { data: transactionData, error: transactionError } = await supabase.rpc(
        "remove_workbench_evidence_item",
        {
          p_cycle_id: cycle.id,
          p_actor_user_id: actorUserId,
          p_question_version_id: questionVersionId,
          p_evidence_id: evidenceData.id,
          p_expected_revision: expectedRevision,
        },
      );
      if (transactionError) {
        const message = `${transactionError.message ?? ""} ${transactionError.details ?? ""}`;
        if (hasDatabaseErrorCode(message, "response_revision_conflict")) {
          return {
            ok: false,
            status: 409,
            error: "Esta resposta foi alterada em outra aba ou por outro usuário. Recarregue o diagnóstico antes de remover a evidência.",
          };
        }
        throw transactionError;
      }
      const transaction = removeMutationResultSchema.parse(transactionData);

      let cleanupPending = false;
      if (transaction.storagePath) {
        const { error: storageError } = await supabase.storage
          .from(BUCKET)
          .remove([transaction.storagePath]);
        if (storageError) {
          cleanupPending = true;
          logError("Failed to remove retired evidence file", storageError, {
            cycleId: cycle.id,
            evidenceId: transaction.evidenceId,
          });
        } else {
          const { error: acknowledgeError } = await supabase
            .from("evidence_storage_cleanup_queue")
            .delete()
            .eq("storage_path", transaction.storagePath);
          if (acknowledgeError) {
            cleanupPending = true;
            logError("Failed to acknowledge retired evidence cleanup", acknowledgeError, {
              cycleId: cycle.id,
              evidenceId: transaction.evidenceId,
            });
          }
        }
      }

      return {
        ok: true,
        cycleId: cycle.id,
        cleanupPending,
      };
    }
  }

  return { ok: false, status: 404, error: "Nenhuma evidência para remover." };
}
