/**
 * Conclusão efetiva de um critério para acompanhamento e FAMI preliminar v2.
 *
 * Espelha os bloqueios de encerramento/supervisão vigentes:
 * ação cancelada não entra no conjunto ativo; aceite exige conclusão, ausência
 * de ajuste aberto e aprovação da revisão vigente; comprovação só bloqueia
 * quando a regra do domínio a exige.
 */

export const ACTION_COMPLETION_BLOCK_REASONS = [
  "missing_recommendation",
  "approved_exception",
  "missing_active_action",
  "action_not_completed",
  "open_supervision_request",
  "missing_execution_evidence",
  "action_not_approved",
] as const;

export type ActionCompletionBlockReason = (typeof ACTION_COMPLETION_BLOCK_REASONS)[number];

export type ActionCompletionSnapshot = {
  status: "todo" | "doing" | "done" | "cancelled";
  progressPercentage: number;
  approved: boolean;
  hasOpenAdjustment: boolean;
  hasRequiredEvidence: boolean;
  requiresEvidence?: boolean;
};

export type CriterionCompletionInput = {
  hasRecommendation: boolean;
  hasApprovedException: boolean;
  actions: readonly ActionCompletionSnapshot[];
};

export type CriterionCompletionResult = {
  criterionCompleted: boolean;
  activeActionCount: number;
  completedActionCount: number;
  blockReasons: ActionCompletionBlockReason[];
};

function isCancelled(action: ActionCompletionSnapshot): boolean {
  return action.status === "cancelled";
}

export function isActionEffectivelyCompleted(action: ActionCompletionSnapshot): boolean {
  if (isCancelled(action)) return false;
  if (action.status !== "done" || action.progressPercentage !== 100) return false;
  if (action.hasOpenAdjustment) return false;
  if (action.requiresEvidence && !action.hasRequiredEvidence) return false;
  return action.approved;
}

export function actionCompletionBlockReason(
  action: ActionCompletionSnapshot,
): ActionCompletionBlockReason | null {
  if (isCancelled(action)) return null;
  if (action.status !== "done" || action.progressPercentage !== 100) {
    return "action_not_completed";
  }
  if (action.hasOpenAdjustment) return "open_supervision_request";
  if (action.requiresEvidence && !action.hasRequiredEvidence) {
    return "missing_execution_evidence";
  }
  if (!action.approved) return "action_not_approved";
  return null;
}

export function evaluateCriterionCompletion(
  input: CriterionCompletionInput,
): CriterionCompletionResult {
  const blockReasons: ActionCompletionBlockReason[] = [];
  if (!input.hasRecommendation) {
    return {
      criterionCompleted: false,
      activeActionCount: 0,
      completedActionCount: 0,
      blockReasons: ["missing_recommendation"],
    };
  }
  if (input.hasApprovedException) {
    return {
      criterionCompleted: false,
      activeActionCount: 0,
      completedActionCount: 0,
      blockReasons: ["approved_exception"],
    };
  }

  const active = input.actions.filter((action) => !isCancelled(action));
  if (active.length === 0) {
    return {
      criterionCompleted: false,
      activeActionCount: 0,
      completedActionCount: 0,
      blockReasons: ["missing_active_action"],
    };
  }

  const completed = active.filter(isActionEffectivelyCompleted);
  const uniqueBlocks = new Set<ActionCompletionBlockReason>();
  for (const action of active) {
    const reason = actionCompletionBlockReason(action);
    if (reason) uniqueBlocks.add(reason);
  }
  blockReasons.push(...uniqueBlocks);

  return {
    criterionCompleted: completed.length === active.length,
    activeActionCount: active.length,
    completedActionCount: completed.length,
    blockReasons,
  };
}
