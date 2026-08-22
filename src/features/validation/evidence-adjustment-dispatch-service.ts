import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DomainValidationError } from "@/infrastructure/api/domain-errors";
import { logInfo } from "@/infrastructure/observability/logger";
import {
  cycleValidationStateError,
  rpcErrorMessage,
} from "@/features/cycles/server";

export type DispatchEvidenceAdjustmentsResult = {
  cycleId: string;
  fromState: "in_validation";
  toState: "awaiting_adjustment";
  adjustmentCount: number;
  proofRequestCount: number;
  totalCount: number;
};

/**
 * Encerra a rodada administrativa e envia, em uma única devolutiva, todas as
 * evidências previamente marcadas para ajuste e as solicitações de comprovação.
 */
export async function dispatchEvidenceAdjustments(
  supabase: SupabaseClient,
  cycleId: string,
  actorUserId: string,
): Promise<DispatchEvidenceAdjustmentsResult> {
  const { data, error } = await supabase.rpc("dispatch_evidence_adjustments", {
    p_cycle_id: cycleId,
    p_actor_user_id: actorUserId,
  });

  if (error) {
    const message = rpcErrorMessage(error);
    if (hasDatabaseErrorCode(message, "no_adjustments_to_dispatch")) {
      throw new DomainValidationError([
        {
          path: "_",
          message: "Nenhuma solicitação de ajuste foi preparada para envio.",
        },
      ]);
    }
    if (hasDatabaseErrorCode(message, "validation_queue_has_pending_items")) {
      throw new DomainValidationError([
        {
          path: "_",
          message:
            "Conclua a análise de todas as evidências e respostas “não se aplica” antes de enviar as solicitações de ajuste.",
        },
      ]);
    }
    const stateError = cycleValidationStateError(message, {
      codes: ["cycle_not_in_validation", "invalid_cycle_transition", "cycle_not_found"],
      operationMessage:
        "As solicitações de ajuste só podem ser enviadas com o diagnóstico em validação.",
    });
    if (stateError) throw stateError;
    throw error;
  }

  const raw = data as {
    cycleId: string;
    fromState: "in_validation";
    toState: "awaiting_adjustment";
    adjustmentCount?: number;
    proofRequestCount?: number;
  };
  const adjustmentCount = Number(raw.adjustmentCount ?? 0);
  const proofRequestCount = Number(raw.proofRequestCount ?? 0);
  const result: DispatchEvidenceAdjustmentsResult = {
    cycleId: raw.cycleId,
    fromState: raw.fromState,
    toState: raw.toState,
    adjustmentCount,
    proofRequestCount,
    totalCount: adjustmentCount + proofRequestCount,
  };
  logInfo("evidence.adjustments_dispatched", {
    cycleId,
    adjustmentCount: result.adjustmentCount,
    proofRequestCount: result.proofRequestCount,
    totalCount: result.totalCount,
    actorUserId,
  });
  return result;
}
