import type { LucideIcon } from "lucide-react";
import type { ActionPlanListItem } from "@/features/improvement-management/action-plans/types";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import type { PlanStatus } from "@/features/improvement-management/action-plans/schemas";
import { isActionPlanEligible } from "@/shared/domain/workflow";
import { RECOMMENDATION_REGISTRY } from "@/shared/ui/status-registry";
import type { RecommendationStatus } from "./schemas";
import type { RecommendationStatusVariant } from "./presentation-types";
import { progressFromPlans } from "@/features/improvement-management/action-plans/plan-progress";
import { pickDisplayPlan } from "@/features/improvement-management/action-plans/plan-selectors";

export type StatusMeta = {
  label: string;
  description: string;
  icon: LucideIcon;
  badgeClasses: string;
  columnBg: string;
  /** Campo opcional presente na visão de respondente; undefined na visão admin. */
  variant?: RecommendationStatusVariant;
};

export const STATUS_META: Record<RecommendationStatus, StatusMeta> = Object.fromEntries(
  (Object.keys(RECOMMENDATION_REGISTRY) as RecommendationStatus[]).map((k) => {
    const e = RECOMMENDATION_REGISTRY[k];
    return [
      k,
      {
        label: e.label,
        description: e.description ?? "",
        icon: e.icon!,
        badgeClasses: e.colorClass,
        columnBg: e.columnBg ?? "",
      },
    ];
  }),
) as Record<RecommendationStatus, StatusMeta>;

export type AdminRecommendationItem = {
  recommendationId: string;
  questionId: string;
  plans: ActionPlanAction[];
  planId: string | null;
  organizationId: string;
  organizationName: string;
  formId: string;
  cycleId: string;
  cycleState: string;
  canCreateActionPlan: boolean;
  periodLabel: string;
  formName: string;
  formVersion: number;
  axisId: string;
  axisName: string;
  sectionId: string;
  sectionName: string;
  sectionOrder: number;
  questionOrder: number;
  questionPrompt: string;
  recommendationText: string;
  recommendationType: string;
  recommendationStatus: RecommendationStatus;
  planStatus: PlanStatus | null;
  hasPlan: boolean;
  isOverdue: boolean;
  isDueSoon: boolean;
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  responsibleName: string | null;
  responsibleSector: string | null;
  updatedAt: string | null;
  recommendationCreatedAt: string | null;
};

export function toAdminItem(row: ActionPlanListItem): AdminRecommendationItem {
  const plan = pickDisplayPlan(row);
  const planStatus = plan?.status ?? null;
  return {
    recommendationId: row.recommendationId,
    questionId: row.questionId,
    plans: row.plans,
    planId: plan?.id ?? null,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    formId: row.formId,
    cycleId: row.cycleId ?? "",
    cycleState: row.cycleState,
    canCreateActionPlan: isActionPlanEligible(row.cycleState),
    periodLabel: row.periodLabel ?? "",
    formName: row.formName,
    formVersion: row.formVersion,
    axisId: row.axisId ?? "",
    axisName: row.axisName,
    sectionId: row.sectionId,
    sectionName: row.sectionName,
    sectionOrder: row.sectionOrder,
    questionOrder: row.questionOrder,
    questionPrompt: row.questionPrompt,
    recommendationText: row.recommendationText,
    recommendationType: row.recommendationType,
    recommendationStatus: row.recommendationStatus,
    planStatus,
    hasPlan: row.plans.length > 0,
    isOverdue: row.slaLabel === "overdue",
    isDueSoon: row.slaLabel === "due_soon",
    progress: progressFromPlans(row.plans),
    startDate: plan?.startDate ?? null,
    dueDate: plan?.dueDate ?? null,
    responsibleName: plan?.responsibleName ?? null,
    responsibleSector: plan?.responsibleSector ?? null,
    updatedAt: plan?.updatedAt ?? null,
    recommendationCreatedAt: row.recommendationCreatedAt ?? null,
  };
}

export type AdminRecommendationSummary = {
  total: number;
  withoutPlan: number;
  withPlan: number;
  inExecution: number;
  completed: number;
  overdue: number;
};

export function summarize(items: AdminRecommendationItem[]): AdminRecommendationSummary {
  const s: AdminRecommendationSummary = {
    total: items.length,
    withoutPlan: 0,
    withPlan: 0,
    inExecution: 0,
    completed: 0,
    overdue: 0,
  };
  for (const i of items) {
    if (i.hasPlan) s.withPlan += 1;
    if (!i.hasPlan && i.recommendationStatus === "generated") s.withoutPlan += 1;
    if (
      ["in_action_plan", "adjustment_requested", "awaiting_approval", "exception_requested"].includes(
        i.recommendationStatus,
      ) || i.planStatus === "in_progress"
    ) {
      s.inExecution += 1;
    }
    if (i.recommendationStatus === "completed") s.completed += 1;
    if (i.isOverdue) s.overdue += 1;
  }
  return s;
}

export type OrganizationSummary = {
  organizationId: string;
  organizationName: string;
  total: number;
  inExecution: number;
  withoutPlan: number;
  overdue: number;
  completed: number;
  executionPct: number;
};

export function groupByOrganization(items: AdminRecommendationItem[]): OrganizationSummary[] {
  const map = new Map<string, AdminRecommendationItem[]>();
  for (const i of items) {
    const arr = map.get(i.organizationId) ?? [];
    arr.push(i);
    map.set(i.organizationId, arr);
  }
  const groups: OrganizationSummary[] = [];
  for (const [orgId, rows] of map) {
    const counters: OrganizationSummary = {
      organizationId: orgId,
      organizationName: rows[0]?.organizationName ?? "(org)",
      total: rows.length,
      inExecution: 0,
      withoutPlan: 0,
      overdue: 0,
      completed: 0,
      executionPct: 0,
    };
    for (const r of rows) {
      if (
        ["in_action_plan", "adjustment_requested", "awaiting_approval", "exception_requested"].includes(
          r.recommendationStatus,
        ) || r.planStatus === "in_progress"
      ) {
        counters.inExecution += 1;
      }
      if (!r.hasPlan && r.recommendationStatus === "generated") counters.withoutPlan += 1;
      if (r.isOverdue) counters.overdue += 1;
      if (r.recommendationStatus === "completed") counters.completed += 1;
    }
    counters.executionPct =
      counters.total === 0 ? 0 : Math.round((counters.completed / counters.total) * 100);
    groups.push(counters);
  }
  return groups.sort(
    (a, b) => b.overdue - a.overdue || a.organizationName.localeCompare(b.organizationName, "pt-BR"),
  );
}

const ADMIN_RECOMMENDATION_KANBAN_ORDER: RecommendationStatus[] = [
  "generated",
  "in_action_plan",
  "adjustment_requested",
  "exception_requested",
  "awaiting_approval",
  "completed",
  "dismissed",
];

export function groupByStatus(
  items: AdminRecommendationItem[],
): { status: RecommendationStatus; rows: AdminRecommendationItem[] }[] {
  const map = new Map<RecommendationStatus, AdminRecommendationItem[]>();
  for (const i of items) {
    const arr = map.get(i.recommendationStatus) ?? [];
    arr.push(i);
    map.set(i.recommendationStatus, arr);
  }
  return ADMIN_RECOMMENDATION_KANBAN_ORDER.filter((s) => (map.get(s)?.length ?? 0) > 0).map((s) => ({
    status: s,
    rows: map.get(s) ?? [],
  }));
}

export { progressFromPlan } from "@/features/improvement-management/action-plans/plan-progress";
