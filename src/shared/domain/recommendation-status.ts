import { z } from "zod";
import type { ActionPlanStatus, DerivedRecommendationStatus } from "./types";

/**
 * Situações canônicas de uma recomendação.
 *
 * Não há status persistido: a situação é derivada do conjunto oficial formado por
 * dispensa, exceção, ações, pedidos de ajuste e aceites da revisão atual. Isso
 * evita estados redundantes ou divergentes entre interface, relatórios e banco.
 */
export const recommendationStatusSchema = z.enum([
  "generated",
  "in_action_plan",
  "awaiting_approval",
  "adjustment_requested",
  "exception_requested",
  "completed",
  "dismissed",
]);

export type RecommendationStatus = z.infer<typeof recommendationStatusSchema>;
export type { DerivedRecommendationStatus };

export type ActionPlanStatusInput = {
  status: ActionPlanStatus | string;
};

/** Deriva a situação canônica da recomendação a partir do seu contexto oficial. */
export function deriveRecommendationStatus(
  actions: ActionPlanStatusInput[],
  waived: boolean,
  context: {
    hasOpenAdjustment?: boolean;
    hasPendingException?: boolean;
    allCompletedActionsApproved?: boolean;
  } = {},
): DerivedRecommendationStatus {
  if (waived) return "dismissed";
  if (context.hasPendingException) return "exception_requested";
  if (actions.length === 0) return "generated";

  const statuses = actions.map((action) => action.status);
  const hasActiveAction = statuses.some(
    (status) =>
      status === "todo" ||
      status === "doing" ||
      status === "not_started" ||
      status === "in_progress",
  );
  const hasCompletedAction = statuses.some(
    (status) => status === "done" || status === "completed",
  );
  const onlyCancelledActions = statuses.every((status) => status === "cancelled");

  if (onlyCancelledActions) return "generated";
  if (context.hasOpenAdjustment) return "adjustment_requested";
  if (hasActiveAction) return "in_action_plan";
  if (hasCompletedAction && context.allCompletedActionsApproved) return "completed";
  if (hasCompletedAction) return "awaiting_approval";
  return "generated";
}
