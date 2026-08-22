import type { SupabaseClient } from "@supabase/supabase-js";
import { DomainConflictError, DomainValidationError } from "@/infrastructure/api/domain-errors";
import type { CycleState } from "@/shared/domain/types";
import { commitCycleTransition } from "@/features/cycles/commit";
import { CycleStateService } from "@/features/cycles/cycle-state-service";
import { collectSubmissionQuestions } from "@/features/cycles/submission-collect";
import { evaluateSubmissionReadiness } from "@/shared/domain/submission";
import { logInfo } from "@/infrastructure/observability/logger";

export type SubmitCycleResult = {
  cycleId: string;
  fromState: CycleState;
  toState: CycleState;
};

function resolveSubmitTarget(state: CycleState): CycleState | null {
  if (state === "in_response") return "submitted";
  if (state === "awaiting_adjustment") return "in_validation";
  return null;
}

/**
 * Envia o diagnóstico para a validação. Recomendações oficiais não são criadas
 * neste momento: elas só são materializadas quando a validação é consolidada.
 */
export async function submitCycle(
  supabase: SupabaseClient,
  cycleId: string,
  actorUserId: string,
): Promise<SubmitCycleResult> {
  const service = new CycleStateService(supabase);
  const cycle = await service.require(cycleId);
  if (cycle.responseCollectionPausedAt) {
    throw new DomainConflictError(
      "A coleta deste diagnóstico está temporariamente suspensa pela administração.",
    );
  }
  const toState = resolveSubmitTarget(cycle.state);
  if (!toState) {
    throw new DomainConflictError("O diagnóstico não está em uma etapa que permite envio.");
  }

  const readiness = evaluateSubmissionReadiness(
    await collectSubmissionQuestions(supabase, cycleId),
    { requireResolvedAdjustments: cycle.state === "awaiting_adjustment" },
  );
  if (!readiness.ready) {
    throw new DomainValidationError(
      readiness.blocks.map((block) => ({
        path: `questions.${block.questionId}`,
        message:
          block.reason === "unanswered"
            ? "Pergunta obrigatória sem resposta."
            : "A solicitação de ajuste da evidência ainda não foi resolvida.",
      })),
      "Há itens pendentes antes do envio.",
    );
  }

  const result = await commitCycleTransition(supabase, {
    cycleId,
    actorUserId,
    toState,
    expectedFromState: cycle.state,
  });

  logInfo("cycle.submitted", {
    cycleId,
    from: cycle.state,
    to: result.toState,
    actorUserId,
  });

  return {
    cycleId,
    fromState: cycle.state,
    toState: result.toState as CycleState,
  };
}
