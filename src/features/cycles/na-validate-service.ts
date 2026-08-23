import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DomainValidationError,
  DomainNotFoundError,
  DomainConflictError,
} from "@/infrastructure/api/domain-errors";
import { logError, logInfo } from "@/infrastructure/observability/logger";
import { cycleValidationStateError, rpcErrorMessage } from "@/features/cycles/rpc-validation-errors";
import {
  canInvokeLocalDatabaseRpc,
  invokeLocalDatabaseRpc,
} from "@/infrastructure/supabase/local-database-rpc";

type ValidateNaAction = "approve" | "reject";

export type ValidateNaInput = {
  action: ValidateNaAction;
  /** Obrigatório na rejeição; ignorado na aprovação. */
  rejectionReason?: string | null;
  actorUserId: string;
  expectedStatus: "pending" | "approved" | "rejected";
  expectedValidatedAt: string | null;
};

export type ValidateNaResult = {
  responseId: string;
  answer: "not_applicable" | "no";
  naValidationStatus: "approved" | "rejected";
  cycleId: string;
  rejected: boolean;
  validatedAt: string;
};

/**
 * Aprova ou rejeita “não se aplica” na fila de validação.
 * Rejeitar converte a resposta para “Não” (RPC atômica).
 */
export async function validateNotApplicableResponse(
  supabase: SupabaseClient,
  cycleId: string,
  responseId: string,
  input: ValidateNaInput,
): Promise<ValidateNaResult> {
  if (input.action !== "approve" && input.action !== "reject") {
    throw new DomainValidationError([
      { path: "action", message: "Ação inválida para validação de “não se aplica”." },
    ]);
  }

  const rejectionReason =
    input.action === "reject"
      ? (input.rejectionReason?.trim() || null)
      : null;

  if (input.action === "reject" && !rejectionReason) {
    throw new DomainValidationError([
      {
        path: "rejectionReason",
        message: "Informe o motivo da rejeição.",
      },
    ]);
  }

  let data: unknown = null;
  let error: unknown = null;

  if (canInvokeLocalDatabaseRpc()) {
    try {
      const expectedAt = input.expectedValidatedAt;
      const row = await invokeLocalDatabaseRpc<{ result: unknown }>(
        expectedAt == null
          ? `select public.validate_not_applicable_response(
               $1::uuid, $2::uuid, $3::text, $4::uuid, $5::text, $6::text, null::timestamptz
             ) as result`
          : `select public.validate_not_applicable_response(
               $1::uuid, $2::uuid, $3::text, $4::uuid, $5::text, $6::text, $7::timestamptz
             ) as result`,
        expectedAt == null
          ? [
              responseId,
              cycleId,
              input.action,
              input.actorUserId,
              rejectionReason,
              input.expectedStatus,
            ]
          : [
              responseId,
              cycleId,
              input.action,
              input.actorUserId,
              rejectionReason,
              input.expectedStatus,
              expectedAt,
            ],
      );
      data = row.result;
    } catch (caught) {
      error = caught;
    }
  } else {
    ({ data, error } = await supabase.rpc("validate_not_applicable_response", {
      p_response_id: responseId,
      p_cycle_id: cycleId,
      p_action: input.action,
      p_actor_user_id: input.actorUserId,
      p_rejection_reason: rejectionReason,
      p_expected_status: input.expectedStatus,
      p_expected_validated_at: input.expectedValidatedAt,
    }));
  }

  if (error) {
    const msg = rpcErrorMessage(error);
    if (hasDatabaseErrorCode(msg, "response_not_found")) {
      throw new DomainNotFoundError("Resposta não encontrada.");
    }
    if (hasDatabaseErrorCode(msg, "response_not_in_cycle")) {
      throw new DomainConflictError("Resposta não pertence ao diagnóstico informado.");
    }
    if (hasDatabaseErrorCode(msg, "validation_conflict")) {
      logError("na.validation_conflict", error, {
        responseId,
        cycleId,
        action: input.action,
        expectedStatus: input.expectedStatus,
        expectedValidatedAt: input.expectedValidatedAt,
        rpcMessage: msg,
      });
      throw new DomainConflictError(
        "Este parecer foi alterado por outro administrador. A fila será atualizada; revise o estado atual antes de tentar novamente.",
      );
    }
    if (hasDatabaseErrorCode(msg, "response_not_reviewable_na")) {
      throw new DomainValidationError([
        {
          path: "action",
          message: "Esta resposta não possui um parecer “não se aplica” revisável.",
        },
      ]);
    }
    if (hasDatabaseErrorCode(msg, "na_rejection_reason_required")) {
      throw new DomainValidationError([
        {
          path: "rejectionReason",
          message: "Informe o motivo da rejeição.",
        },
      ]);
    }
    const stateError = cycleValidationStateError(msg, {
      codes: ["cycle_not_in_validation", "cycle_not_found", "invalid_action"],
      operationMessage:
        "A validação de “não se aplica” só é possível com o diagnóstico em validação.",
    });
    if (stateError) throw stateError;
    throw error;
  }

  const result = data as {
    responseId: string;
    answer: "not_applicable" | "no";
    naValidationStatus: "approved" | "rejected";
    cycleId: string;
    rejected?: boolean;
    validatedAt: string;
  };

  logInfo("na.validated", {
    responseId,
    cycleId: result.cycleId,
    action: input.action,
    actorUserId: input.actorUserId,
  });

  return {
    responseId: result.responseId,
    answer: result.answer,
    naValidationStatus: result.naValidationStatus,
    cycleId: result.cycleId,
    rejected: Boolean(result.rejected) || input.action === "reject",
    validatedAt: result.validatedAt,
  };
}
