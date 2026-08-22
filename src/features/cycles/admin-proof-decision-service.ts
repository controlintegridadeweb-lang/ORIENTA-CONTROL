import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DomainConflictError,
  DomainNotFoundError,
  DomainValidationError,
} from "@/infrastructure/api/domain-errors";
import { logInfo } from "@/infrastructure/observability/logger";
import {
  cycleValidationStateError,
  rpcErrorMessage,
} from "@/features/cycles/rpc-validation-errors";
import type { AdminProofStatus } from "@/shared/domain/types";

export type AdminProofDecisionAction =
  | "validate_without_proof"
  | "request_proof"
  | "consider_insufficient";

export type AdminProofDecisionResult = {
  responseId: string;
  cycleId: string;
  answer?: "yes" | "no";
  adminProofStatus: AdminProofStatus;
  adminProofDecidedAt?: string | null;
  validationRound?: number;
};

function mapRpcError(error: { message?: string }) {
  const msg = rpcErrorMessage(error);
  if (hasDatabaseErrorCode(msg, "response_not_found")) {
    throw new DomainNotFoundError("Resposta não encontrada.");
  }
  if (hasDatabaseErrorCode(msg, "response_not_in_cycle")) {
    throw new DomainConflictError(
      "Resposta não pertence ao diagnóstico informado.",
    );
  }
  if (hasDatabaseErrorCode(msg, "admin_proof_conflict")) {
    throw new DomainConflictError(
      "Este parecer foi alterado por outro administrador. A fila será atualizada; revise o estado atual antes de tentar novamente.",
    );
  }
  if (hasDatabaseErrorCode(msg, "admin_proof_observation_required")) {
    throw new DomainValidationError([
      {
        path: "observation",
        message: "Informe a observação da validação.",
      },
    ]);
  }
  if (hasDatabaseErrorCode(msg, "admin_proof_requires_yes")) {
    throw new DomainValidationError([
      {
        path: "responseId",
        message:
          "Esta decisão não se aplica ao estado atual da resposta (use “Considerar insuficiente” para “Não” elegível a N/A).",
      },
    ]);
  }
  if (hasDatabaseErrorCode(msg, "admin_proof_requires_absent_document")) {
    throw new DomainValidationError([
      {
        path: "responseId",
        message:
          "Esta decisão só se aplica quando não há comprovação apresentada.",
      },
    ]);
  }
  if (hasDatabaseErrorCode(msg, "admin_proof_requires_evidence_criterion")) {
    throw new DomainValidationError([
      {
        path: "responseId",
        message: "Este critério não exige comprovação.",
      },
    ]);
  }
  if (hasDatabaseErrorCode(msg, "admin_proof_blocked_by_not_applicable")) {
    throw new DomainValidationError([
      {
        path: "responseId",
        message:
          "Critério classificado como “Não se aplica” não recebe decisão de comprovação.",
      },
    ]);
  }
  const stateError = cycleValidationStateError(msg, {
    codes: ["cycle_not_in_validation", "cycle_not_found", "global_admin_required"],
    operationMessage:
      "A decisão só é possível com o diagnóstico em validação.",
  });
  if (stateError) throw stateError;
  throw error;
}

export async function decideResponseWithoutProof(
  supabase: SupabaseClient,
  cycleId: string,
  responseId: string,
  input: {
    action: AdminProofDecisionAction;
    observation: string;
    actorUserId: string;
    expectedStatus?: string | null;
    expectedDecidedAt?: string | null;
  },
): Promise<AdminProofDecisionResult> {
  const observation = input.observation.trim();
  if (!observation) {
    throw new DomainValidationError([
      { path: "observation", message: "Informe a observação da validação." },
    ]);
  }

  const { data, error } = await supabase.rpc("decide_response_without_proof", {
    p_response_id: responseId,
    p_cycle_id: cycleId,
    p_actor_user_id: input.actorUserId,
    p_action: input.action,
    p_observation: observation,
    p_expected_status: input.expectedStatus ?? null,
    p_expected_decided_at: input.expectedDecidedAt ?? null,
  });

  if (error) mapRpcError(error);

  const result = data as AdminProofDecisionResult;
  logInfo("admin_proof_decision.recorded", {
    responseId,
    cycleId,
    action: input.action,
    actorUserId: input.actorUserId,
  });
  return result;
}
