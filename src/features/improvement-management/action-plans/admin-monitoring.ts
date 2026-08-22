import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";
import type { ActionPlanListItem } from "./types";
import type { ActionPlanAction } from "./domain-model";
import type { PlanStatus } from "./schemas";
import type { RecommendationStatus } from "@/shared/domain/recommendation-status";
import { ACTION_PLAN_REGISTRY } from "@/shared/ui/status-registry";

export type StatusMeta = {
  label: string;
  description: string;
  icon: LucideIcon;
  badgeClasses: string;
  columnBg: string;
};

export const STATUS_META: Record<PlanStatus, StatusMeta> = Object.fromEntries(
  (Object.keys(ACTION_PLAN_REGISTRY) as PlanStatus[]).map((k) => {
    const e = ACTION_PLAN_REGISTRY[k];
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
) as Record<PlanStatus, StatusMeta>;

export type RiskLevel = "healthy" | "low" | "medium" | "high";

export type RiskMeta = {
  label: string;
  description: string;
  icon: LucideIcon;
  badgeClasses: string;
};

export const RISK_META: Record<RiskLevel, RiskMeta> = {
  healthy: {
    label: "Saudável",
    description: "Execução em dia.",
    icon: ShieldCheck,
    badgeClasses: "bg-brand-50/70 text-brand-700",
  },
  low: {
    label: "Baixo risco",
    icon: ShieldQuestion,
    badgeClasses: "bg-slate-50 text-slate-600",
    description: "",
  },
  medium: {
    label: "Médio risco",
    icon: AlertTriangle,
    badgeClasses: "bg-amber-50/70 text-amber-700",
    description: "",
  },
  high: {
    label: "Alto risco",
    icon: ShieldAlert,
    badgeClasses: "bg-rose-50/70 text-rose-700",
    description: "",
  },
};


/** Progresso persistido da ação; ausência → 0. */
export function progressFromAction(
  plan: { progressPercentage: number } | null | undefined,
): number {
  return plan?.progressPercentage ?? 0;
}

const MS_PER_DAY = 86_400_000;

function daysSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const ref = new Date(iso);
  if (Number.isNaN(ref.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - ref.getTime()) / MS_PER_DAY));
}

function lastActivityLabel(iso: string | null | undefined, now: Date = new Date()): string {
  const days = daysSince(iso, now);
  if (days == null) return "Sem atualização";
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  return `Há ${days} dias`;
}

export type AdminPlanView = PlanStatus | "overdue";

/** Atraso é uma visão derivada do SLA, nunca um estado gravável. */
export function derivePlanView(row: ActionPlanListItem, _now: Date = new Date()): AdminPlanView {
  const plan = row.plans[0] ?? null;
  if (!plan) return "not_started";
  if (row.slaLabel === "overdue") return "overdue";
  return plan.status;
}

export function deriveRiskScore(row: ActionPlanListItem, now: Date = new Date()): number {
  const plan = row.plans[0] ?? null;
  if (!plan) return 50;
  if (plan.status === "completed") return 0;
  if (plan.status === "cancelled") return 10;
  let score = 0;
  if (row.slaLabel === "overdue") score += 40;
  else if (row.slaLabel === "due_soon") score += 15;
  const days = daysSince(plan.updatedAt, now);
  if (days != null && days > 14) score += 20;
  if (plan.progressPercentage <= 25) score += 20;
  if (!plan.responsibleName?.trim()) score += 10;
  return Math.max(0, Math.min(100, score));
}

export function riskLevelFromScore(score: number, hasPlan: boolean, completed: boolean): RiskLevel {
  if (completed) return "healthy";
  if (!hasPlan) return "medium";
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

export type AdminPlanItem = {
  rowKey: string;
  recommendationId: string;
  questionId: string;
  planId: string | null;
  organizationId: string;
  organizationName: string;
  formId: string;
  cycleId: string;
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
  view: AdminPlanView;
  riskScore: number;
  risk: RiskLevel;
  hasPlan: boolean;
  isOverdue: boolean;
  isDueSoon: boolean;
  planStatus: PlanStatus | null;
  actionText: string;
  observations: string | null;
  responsibleName: string;
  responsibleSector: string;
  startDate: string | null;
  dueDate: string | null;
  updatedAt: string | null;
  lastActivityLabel: string;
  progress: number;
  totalActionsForRecommendation: number;
  slaLabel: ActionPlanListItem["slaLabel"];
};

export function toAdminPlanItem(row: ActionPlanListItem, now: Date = new Date()): AdminPlanItem {
  const plan = row.plans[0] ?? null;
  const view = derivePlanView(row, now);
  const completed = plan?.status === "completed";
  const riskScore = deriveRiskScore(row, now);
  return {
    rowKey: `${row.recommendationId}:${plan?.id ?? "none"}`,
    recommendationId: row.recommendationId,
    questionId: row.questionId,
    planId: plan?.id ?? null,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    formId: row.formId,
    cycleId: row.cycleId ?? "",
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
    view,
    riskScore,
    risk: riskLevelFromScore(riskScore, row.plans.length > 0, completed),
    hasPlan: row.plans.length > 0,
    isOverdue: view === "overdue",
    isDueSoon: row.slaLabel === "due_soon",
    planStatus: plan?.status ?? null,
    actionText: plan?.actionText ?? "",
    observations: plan?.observations ?? null,
    responsibleName: plan?.responsibleName ?? "",
    responsibleSector: plan?.responsibleSector ?? "",
    startDate: plan?.startDate || null,
    dueDate: plan?.dueDate || null,
    updatedAt: plan?.updatedAt || null,
    lastActivityLabel: lastActivityLabel(plan?.updatedAt, now),
    progress: progressFromAction(plan),
    totalActionsForRecommendation: row.recommendationActionCount ?? row.plans.length,
    slaLabel: row.slaLabel,
  };
}

export type OrganizationSummary = {
  organizationId: string;
  organizationName: string;
  total: number;
  inProgress: number;
  withoutPlan: number;
  overdue: number;
  completed: number;
  highRisk: number;
  averageProgress: number;
  executionPct: number;
};

export function groupByOrganization(items: AdminPlanItem[]): OrganizationSummary[] {
  const map = new Map<string, AdminPlanItem[]>();
  for (const i of items) {
    const arr = map.get(i.organizationId) ?? [];
    arr.push(i);
    map.set(i.organizationId, arr);
  }
  const groups: OrganizationSummary[] = [];
  for (const [orgId, rows] of map) {
    let progressSum = 0;
    const counters: OrganizationSummary = {
      organizationId: orgId,
      organizationName: rows[0]?.organizationName ?? "(org)",
      total: rows.length,
      inProgress: 0,
      withoutPlan: 0,
      overdue: 0,
      completed: 0,
      highRisk: 0,
      averageProgress: 0,
      executionPct: 0,
    };
    for (const r of rows) {
      progressSum += r.progress;
      if (
        r.planStatus === "in_progress" ||
        r.planStatus === "not_started"
      ) {
        counters.inProgress += 1;
      }
      if (!r.hasPlan) counters.withoutPlan += 1;
      if (r.isOverdue) counters.overdue += 1;
      if (r.planStatus === "completed") {
        counters.completed += 1;
      }
      if (r.risk === "high") counters.highRisk += 1;
    }
    counters.averageProgress =
      counters.total === 0 ? 0 : Math.round(progressSum / counters.total);
    counters.executionPct =
      counters.total === 0 ? 0 : Math.round((counters.completed / counters.total) * 100);
    groups.push(counters);
  }
  return groups.sort(
    (a, b) => b.highRisk - a.highRisk || b.overdue - a.overdue || a.organizationName.localeCompare(b.organizationName, "pt-BR"),
  );
}

export type AdminPlanSummary = {
  total: number;
  inProgress: number;
  completed: number;
  overdue: number;
  withoutResponsible: number;
  dueSoon: number;
  highRisk: number;
  lowProgress: number;
};

export function summarize(items: AdminPlanItem[]): AdminPlanSummary {
  const s: AdminPlanSummary = {
    total: items.length,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    withoutResponsible: 0,
    dueSoon: 0,
    highRisk: 0,
    lowProgress: 0,
  };
  for (const i of items) {
    if (i.planStatus === "completed") {
      s.completed += 1;
    }
    if (
      i.planStatus === "in_progress" ||
      i.planStatus === "not_started"
    ) {
      s.inProgress += 1;
    }
    if (i.isOverdue) s.overdue += 1;
    if (i.isDueSoon) s.dueSoon += 1;
    if (i.hasPlan && !i.responsibleName?.trim()) s.withoutResponsible += 1;
    if (i.risk === "high") s.highRisk += 1;
    if (i.hasPlan && i.progress <= 25) s.lowProgress += 1;
  }
  return s;
}
/** Adapta uma linha administrativa de monitoramento para a ação canônica de leitura. */
export function actionFromAdminPlanItem(item: AdminPlanItem): ActionPlanAction | null {
  if (!item.planId || !item.planStatus) return null;
  return {
    id: item.planId,
    actionText: item.actionText,
    startDate: item.startDate ?? "",
    dueDate: item.dueDate ?? "",
    responsibleSector: item.responsibleSector,
    responsibleUserId: null,
    responsibleName: item.responsibleName,
    progressPercentage: item.progress,
    status: item.planStatus,
    observations: item.observations,
    updatedAt: item.updatedAt ?? "",
    revision: 1,
    documents: [],
    slaLabel: item.slaLabel,
  };
}
