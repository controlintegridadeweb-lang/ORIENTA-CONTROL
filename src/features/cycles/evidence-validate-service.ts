import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DomainValidationError,
  DomainNotFoundError,
  DomainConflictError,
} from "@/infrastructure/api/domain-errors";
import { logInfo } from "@/infrastructure/observability/logger";
import { cycleValidationStateError, rpcErrorMessage } from "@/features/cycles/rpc-validation-errors";

/**
 * Validação de evidência pelo admin (6.2/452).
 *
 * Três ações: aprovar, não aprovar, solicitar ajuste. O veredito é EMBUTIDO em
 * `evidences` (validation_status = approved│invalidated│adjustment_requested; pending é o inicial) — não
 * há tabela separada; o histórico vive em audit_logs.
 *
 *   • approve → validation_status = approved
 *   • invalidate → validation_status = invalidated (exige justificativa)
 *   • request_adjustment → validation_status = adjustment_requested (exige justificativa).
 *     O diagnóstico permanece em validação até o administrador enviar todas
 *     as solicitações preparadas em uma devolutiva consolidada.
 *
 * Cada decisão possui um veredito próprio. A distinção é persistida na
 * evidência e no snapshot; nenhuma tela precisa deduzi-la pelo estado global
 * do ciclo. Vereditos negativos exigem justificativa no banco.
 */

type ValidateAction = "approve" | "invalidate" | "request_adjustment";

export type ValidateInput = {
  action: ValidateAction;
  /** Obrigatória para invalidate e request_adjustment. */
  justification?: string | null;
  actorUserId: string;
  expectedStatus: "pending" | "approved" | "invalidated" | "adjustment_requested";
  expectedValidatedAt: string | null;
};

export type ValidateResult = {
  evidenceId: string;
  validationStatus: "approved" | "invalidated" | "adjustment_requested";
  cycleId: string;
  /** Estado do ciclo após o registro do veredito. */
  cycleState: string;
  validatedAt: string;
};


export async function validateEvidence(
  supabase: SupabaseClient,
  cycleId: string,
  evidenceId: string,
  input: ValidateInput,
): Promise<ValidateResult> {
  const needsJustification =
    input.action === "invalidate" || input.action === "request_adjustment";
  const justification = input.justification?.trim() ?? "";
  if (needsJustification && justification === "") {
    throw new DomainValidationError([
      {
        path: "justification",
        message: "Não aprovar ou solicitar ajuste exige uma justificativa.",
      },
    ]);
  }

  // A RPC grava somente o veredito. A transição para awaiting_adjustment é
  // uma operação administrativa separada e consolidada, depois da fila inteira.
  const { data, error } = await supabase.rpc("validate_evidence", {
    p_evidence_id: evidenceId,
    p_cycle_id: cycleId,
    p_action: input.action,
    p_actor_user_id: input.actorUserId,
    p_justification: needsJustification ? justification : null,
    p_expected_status: input.expectedStatus,
    p_expected_validated_at: input.expectedValidatedAt,
  });

  if (error) {
    const msg = rpcErrorMessage(error);
    if (hasDatabaseErrorCode(msg, "evidence_not_found")) {
      throw new DomainNotFoundError("Evidência não encontrada.");
    }
    if (hasDatabaseErrorCode(msg, "evidence_not_in_cycle")) {
      throw new DomainConflictError("Evidência não pertence ao diagnóstico informado.");
    }
    if (hasDatabaseErrorCode(msg, "validation_conflict")) {
      throw new DomainConflictError(
        "Este parecer foi alterado por outro administrador. A fila será atualizada; revise o estado atual antes de tentar novamente.",
      );
    }
    if (hasDatabaseErrorCode(msg, "justification_required")) {
      throw new DomainValidationError([
        {
          path: "justification",
          message: "Não aprovar ou solicitar ajuste exige uma justificativa.",
        },
      ]);
    }
    const stateError = cycleValidationStateError(msg, {
      codes: [
        "invalid_cycle_transition",
        "cycle_not_in_validation",
        "cycle_not_found",
      ],
      operationMessage:
        "A validação de evidências só é possível com o diagnóstico em validação.",
    });
    if (stateError) throw stateError;
    throw error;
  }

  const result = data as {
    evidenceId: string;
    validationStatus: "approved" | "invalidated" | "adjustment_requested";
    cycleId: string;
    cycleState: string;
    validatedAt: string;
  };

  logInfo("evidence.validated", {
    evidenceId,
    cycleId: result.cycleId,
    action: input.action,
    validationStatus: result.validationStatus,
    actorUserId: input.actorUserId,
  });

  return {
    evidenceId: result.evidenceId,
    validationStatus: result.validationStatus,
    cycleId: result.cycleId,
    cycleState: result.cycleState,
    validatedAt: result.validatedAt,
  };
}
