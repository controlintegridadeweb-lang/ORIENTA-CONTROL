export const ACTION_PLAN_COMPLETION_BLOCK_REASONS = [
  "exception_pending",
  "missing_active_action",
  "action_not_completed",
  "open_supervision_request",
  "missing_execution_evidence",
  "action_not_approved",
] as const;

export type ActionPlanCompletionBlockReason =
  (typeof ACTION_PLAN_COMPLETION_BLOCK_REASONS)[number];

export type ActionPlanCompletionBlock = {
  recommendationId: string;
  questionId: string;
  questionPrompt: string;
  actionPlanId: string | null;
  actionLabel: string | null;
  reason: ActionPlanCompletionBlockReason;
};

export type ActionPlanCompletionReadiness = {
  ready: boolean;
  pendingCount: number;
  blocks: ActionPlanCompletionBlock[];
  countsByReason: Record<ActionPlanCompletionBlockReason, number>;
};

export function emptyActionPlanCompletionCounts(): Record<
  ActionPlanCompletionBlockReason,
  number
> {
  return {
    exception_pending: 0,
    missing_active_action: 0,
    action_not_completed: 0,
    open_supervision_request: 0,
    missing_execution_evidence: 0,
    action_not_approved: 0,
  };
}
