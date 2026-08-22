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

export type AdminApplicabilityResult = {
  responseId: string;
  cycleId: string;
  answer?: "yes" | "no";
  adminApplicabilityStatus: "not_applicable" | null;
  adminNaDecidedAt?: string | null;
  validationRound?: number;
};

function mapRpcError(error: { message?: string }, operation: "mark" | "revert") {
  const msg = rpcErrorMessage(error);
  if (hasDatabaseErrorCode(msg, "response_not_found")) {
    throw new DomainNotFoundError("Resposta não encontrada.");
  }
  if (hasDatabaseErrorCode(msg, "response_not_in_cycle")) {
    throw new DomainConflictError("Resposta não pertence ao diagnóstico informado.");
  }
  if (
    hasDatabaseErrorCode(msg, "validation_conflict") ||
    hasDatabaseErrorCode(msg, "admin_applicability_conflict")
  ) {
    throw new DomainConflictError(
      "Este parecer foi alterado por outro administrador. A fila será atualizada; revise o estado atual antes de tentar novamente.",
    );
  }
  if (
    hasDatabaseErrorCode(msg, "admin_applicability_busy") ||
    hasDatabaseErrorCode(msg, "lock_not_available") ||
    msg.includes("55P03")
  ) {
    throw new DomainConflictError(
      "Outra operação está atualizando este critério. Aguarde alguns segundos e tente novamente.",
    );
  }
  if (hasDatabaseErrorCode(msg, "question_does_not_allow_admin_not_applicable")) {
    throw new DomainValidationError([
      {
        path: "responseId",
        message: "Este critério não permite a classificação administrativa “Não se aplica”.",
      },
    ]);
  }
  if (hasDatabaseErrorCode(msg, "admin_applicability_requires_yes_or_no")) {
    throw new DomainValidationError([
      {
        path: "responseId",
        message:
          "Somente respostas “Sim” ou “Não” do respondente podem receber “Não se aplica” administrativo.",
      },
    ]);
  }
  if (hasDatabaseErrorCode(msg, "admin_na_justification_required")) {
    throw new DomainValidationError([
      {
        path: "justification",
        message: "Informe a justificativa da decisão.",
      },
    ]);
  }
  if (
    hasDatabaseErrorCode(msg, "admin_na_not_active") ||
    hasDatabaseErrorCode(msg, "admin_applicability_not_marked")
  ) {
    throw new DomainValidationError([
      {
        path: "action",
        message: "Não há decisão administrativa “Não se aplica” ativa para revisar.",
      },
    ]);
  }
  const stateError = cycleValidationStateError(msg, {
    codes: ["cycle_not_in_validation", "cycle_not_found", "global_admin_required"],
    operationMessage:
      operation === "mark"
        ? "A classificação administrativa só é possível com o diagnóstico em validação."
        : "A revisão da classificação só é possível com o diagnóstico em validação.",
  });
  if (stateError) throw stateError;
  throw error;
}

export async function markResponseAdminNotApplicable(
  supabase: SupabaseClient,
  cycleId: string,
  responseId: string,
  input: {
    justification: string;
    actorUserId: string;
    expectedAdminStatus?: string | null;
    expectedDecidedAt?: string | null;
  },
): Promise<AdminApplicabilityResult> {
  const justification = input.justification.trim();
  if (!justification) {
    throw new DomainValidationError([
      { path: "justification", message: "Informe a justificativa da decisão." },
    ]);
  }

  const { data, error } = await supabase.rpc("mark_response_admin_not_applicable", {
    p_response_id: responseId,
    p_cycle_id: cycleId,
    p_actor_user_id: input.actorUserId,
    p_justification: justification,
    p_expected_admin_status: input.expectedAdminStatus ?? null,
    p_expected_decided_at: input.expectedDecidedAt ?? null,
  });

  if (error) mapRpcError(error, "mark");

  const result = data as AdminApplicabilityResult;
  logInfo("admin_applicability.marked", {
    responseId,
    cycleId,
    actorUserId: input.actorUserId,
  });
  return result;
}

export async function revertResponseAdminNotApplicable(
  supabase: SupabaseClient,
  cycleId: string,
  responseId: string,
  input: {
    justification: string;
    actorUserId: string;
    expectedAdminStatus?: string | null;
    expectedDecidedAt?: string | null;
  },
): Promise<AdminApplicabilityResult> {
  const justification = input.justification.trim();
  if (!justification) {
    throw new DomainValidationError([
      { path: "justification", message: "Informe a justificativa da revisão." },
    ]);
  }

  const { data, error } = await supabase.rpc("revert_response_admin_not_applicable", {
    p_response_id: responseId,
    p_cycle_id: cycleId,
    p_actor_user_id: input.actorUserId,
    p_justification: justification,
    p_expected_admin_status: input.expectedAdminStatus ?? null,
    p_expected_decided_at: input.expectedDecidedAt ?? null,
  });

  if (error) mapRpcError(error, "revert");

  const result = data as AdminApplicabilityResult;
  logInfo("admin_applicability.reverted", {
    responseId,
    cycleId,
    actorUserId: input.actorUserId,
  });
  return result;
}

export async function markResponsesAdminNotApplicableBatch(
  supabase: SupabaseClient,
  cycleId: string,
  input: {
    responseIds: string[];
    justification: string;
    actorUserId: string;
  },
): Promise<{
  results: Array<{
    id: string;
    status: "succeeded" | "failed";
    code?: string;
    message?: string;
    result?: AdminApplicabilityResult;
  }>;
}> {
  const justification = input.justification.trim();
  if (!justification) {
    throw new DomainValidationError([
      { path: "justification", message: "Informe a justificativa da decisão." },
    ]);
  }
  if (input.responseIds.length === 0) {
    throw new DomainValidationError([
      { path: "responseIds", message: "Selecione ao menos um critério elegível." },
    ]);
  }

  const { data, error } = await supabase.rpc(
    "mark_responses_admin_not_applicable_batch",
    {
      p_cycle_id: cycleId,
      p_actor_user_id: input.actorUserId,
      p_response_ids: input.responseIds,
      p_justification: justification,
    },
  );
  if (error) mapRpcError(error, "mark");

  const payload = data as {
    results?: Array<{
      id: string;
      status: "success" | "succeeded" | "failed";
      code?: string;
      result?: AdminApplicabilityResult;
    }>;
  };

  return {
    results: (payload.results ?? []).map((item) =>
      item.status === "failed"
        ? {
            id: item.id,
            status: "failed" as const,
            code: item.code ?? "admin_applicability_failed",
          }
        : {
            id: item.id,
            status: "succeeded" as const,
            result: item.result,
          },
    ),
  };
}
