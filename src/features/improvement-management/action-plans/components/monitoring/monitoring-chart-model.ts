import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import type { DonutSlice } from "@/shared/ui/charts/donut-chart";

export const MONITORING_CHART_COLORS = {
  completed: "#10b981",
  overdue: "#f43f5e",
  in_progress: "#38bdf8",
  not_started: "#94a3b8",
  cancelled: "#cbd5e1",
} as const;

export type MonitoringChartItem = {
  action: ActionPlanAction;
  label: string;
};

export type MonitoringActionBar = {
  id: string;
  label: string;
  title: string;
  progress: number;
  color: string;
};

function situationKey(action: ActionPlanAction): keyof typeof MONITORING_CHART_COLORS {
  if (action.status === "cancelled") return "cancelled";
  if (action.status === "completed" || action.progressPercentage >= 100) return "completed";
  if (action.slaLabel === "overdue") return "overdue";
  if (action.progressPercentage > 0 || action.status === "in_progress") return "in_progress";
  return "not_started";
}

const SITUATION_LABELS: Record<keyof typeof MONITORING_CHART_COLORS, string> = {
  completed: "Concluídas",
  overdue: "Em atraso",
  in_progress: "Em andamento",
  not_started: "Não iniciado",
  cancelled: "Canceladas",
};

const SITUATION_ORDER: Array<keyof typeof MONITORING_CHART_COLORS> = [
  "not_started",
  "in_progress",
  "completed",
  "overdue",
  "cancelled",
];

export function monitoringSituationSlices(actions: readonly ActionPlanAction[]): DonutSlice[] {
  const counts: Record<keyof typeof MONITORING_CHART_COLORS, number> = {
    completed: 0,
    overdue: 0,
    in_progress: 0,
    not_started: 0,
    cancelled: 0,
  };
  for (const action of actions) {
    counts[situationKey(action)] += 1;
  }
  return SITUATION_ORDER.map((key) => ({
    key,
    label: SITUATION_LABELS[key],
    value: counts[key],
    color: MONITORING_CHART_COLORS[key],
  }));
}

export function monitoringActionBars(items: readonly MonitoringChartItem[]): MonitoringActionBar[] {
  return items.map((item) => ({
    id: item.action.id,
    label: item.label,
    title: item.action.actionText,
    progress: item.action.progressPercentage,
    color: MONITORING_CHART_COLORS[situationKey(item.action)],
  }));
}
