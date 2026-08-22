import type { LucideIcon } from "lucide-react";
import type { ActionPlanListItem } from "@/features/improvement-management/action-plans/types";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import type { PlanStatus } from "@/features/improvement-management/action-plans/schemas";
import { isActionPlanEligible } from "@/shared/domain/workflow";
import { RECOMMENDATION_REGISTRY } from "@/shared/ui/status-registry";
import type { RecommendationStatus } from "./schemas";
import type { RecommendationStatusVariant } from "./presentation-types";
import {
  progressFromPlan,
} from "@/features/improvement-management/action-plans/plan-progress";
import { pickDisplayPlan } from "@/features/improvement-management/action-plans/plan-selectors";

export type StatusMeta = {
  label: string;
  description: string;
  variant: RecommendationStatusVariant;
  icon: LucideIcon;
  badgeClasses: string;
};

const STATUS_VARIANT_BY_RECOMMENDATION: Record<
  RecommendationStatus,
  RecommendationStatusVariant
> = {
  generated: "neutral",
  in_action_plan: "info",
  awaiting_approval: "warning",
  adjustment_requested: "danger",
  exception_requested: "warning",
  completed: "success",
  dismissed: "muted",
};

export const STATUS_META: Record<RecommendationStatus, StatusMeta> = Object.fromEntries(
  (Object.keys(RECOMMENDATION_REGISTRY) as RecommendationStatus[]).map((k) => {
    const e = RECOMMENDATION_REGISTRY[k];
    return [
      k,
      {
        label: e.label,
        description: e.description ?? "",
        variant: STATUS_VARIANT_BY_RECOMMENDATION[k],
        icon: e.icon!,
        badgeClasses: e.colorClass,
      },
    ];
  }),
) as Record<RecommendationStatus, StatusMeta>;


export type RespondentRecommendationItem = {
  recommendationId: string;
  questionId: string;
  cycleId: string;
  cycleState: string;
  /** A interface só libera a criação de ações após a consolidação do diagnóstico. */
  canCreateActionPlan: boolean;
  periodLabel: string;
  formId: string;
  formName: string;
  formVersion: number;
  organizationId: string;
  organizationName: string;
  axisId: string;
  axisName: string;
  sectionId: string;
  sectionName: string;
  sectionOrder: number;
  questionOrder: number;
  questionPrompt: string;
  recommendationText: string;
  recommendationType: string;
  status: RecommendationStatus;
  planStatus: PlanStatus | null;
  hasPlan: boolean;
  progress: number;
  needsAction: boolean;
  actionCount: number;
  slaLabel: ActionPlanListItem["slaLabel"];
  createdAt: string | null;
  updatedAt: string | null;
  /** Plano em destaque para a UI; a exportação usa `plans`. */
  plan: ActionPlanAction | null;
  /** Todas as ações já agregadas no overview — sem consulta extra. */
  plans: ActionPlanAction[];
};

export type RespondentRecommendationSummary = {
  total: number;
  inProgress: number;
  resolved: number;
  awaitingAction: number;
};

export function summarize(
  items: RespondentRecommendationItem[],
): RespondentRecommendationSummary {
  const s: RespondentRecommendationSummary = {
    total: items.length,
    inProgress: 0,
    resolved: 0,
    awaitingAction: 0,
  };
  for (const i of items) {
    if (i.status === "completed") s.resolved += 1;
    else if (i.status === "in_action_plan") s.inProgress += 1;
    else if (i.status === "generated" && i.needsAction) s.awaitingAction += 1;
  }
  return s;
}




export function toRespondentItem(row: ActionPlanListItem): RespondentRecommendationItem {
  const plan = pickDisplayPlan(row);
  const hasPlan = row.plans.length > 0;
  const status = row.recommendationStatus;
  const canCreateActionPlan = isActionPlanEligible(row.cycleState);
  const needsAction =
    canCreateActionPlan &&
    (status === "generated" ||
      status === "adjustment_requested" ||
      (hasPlan &&
        plan != null &&
        ["not_started", "in_progress"].includes(plan.status)));
  return {
    recommendationId: row.recommendationId,
    questionId: row.questionId,
    cycleId: row.cycleId ?? "",
    cycleState: row.cycleState,
    canCreateActionPlan,
    periodLabel: row.periodLabel ?? "",
    formId: row.formId,
    formName: row.formName,
    formVersion: row.formVersion,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    axisId: row.axisId ?? "",
    axisName: row.axisName,
    sectionId: row.sectionId,
    sectionName: row.sectionName,
    sectionOrder: row.sectionOrder,
    questionOrder: row.questionOrder,
    questionPrompt: row.questionPrompt,
    recommendationText: row.recommendationText,
    recommendationType: row.recommendationType,
    status,
    planStatus: plan?.status ?? null,
    hasPlan,
    progress: plan ? progressFromPlan(plan) : 0,
    needsAction,
    actionCount: row.plans.length,
    slaLabel: row.slaLabel,
    createdAt: plan?.updatedAt ?? null,
    updatedAt: plan?.updatedAt ?? null,
    plan,
    plans: row.plans,
  };
}

export {
  PLAN_PROGRESS_CALCULATION_HINT,
  progressFromPlan,
} from "@/features/improvement-management/action-plans/plan-progress";
