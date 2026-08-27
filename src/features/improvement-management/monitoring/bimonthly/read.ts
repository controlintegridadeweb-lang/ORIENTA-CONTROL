import "server-only";

import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";
import type { Bimester } from "@/shared/domain/calendar-periods";

export type BimonthlyReportSummary = {
  activeActionCount: number;
  notStartedCount: number;
  inProgressCount: number;
  completedCount: number;
  overdueCount: number;
  cancelledCount: number;
  averageProgressPercentage: number;
  completedCriterionCount: number;
  pendingCriterionCount: number;
  actionsCompletedInPeriod: number;
  actionsAdvancedInPeriod: number;
  actionsStagnantInPeriod: number;
  actionsBecameOverdueInPeriod: number;
  criteriaCompletedInPeriod: number;
};

export type BimonthlyReportListItem = {
  id: string;
  cycleId: string;
  referenceYear: number;
  bimester: Bimester;
  reportVersion: number;
  generationKind: "manual" | "automatic";
  generatedBy: string | null;
  generatedAt: string;
  closedAt: string | null;
  periodStart: string;
  periodEnd: string;
  summary: BimonthlyReportSummary;
};

export type BimonthlyHistory = {
  history: BimonthlyReportListItem[];
  latestByPeriod: BimonthlyReportListItem[];
};

function toSummary(row: {
  active_action_count: number;
  not_started_count: number;
  in_progress_count: number;
  completed_count: number;
  overdue_count: number;
  cancelled_count: number;
  average_progress_percentage: number;
  completed_criterion_count: number;
  pending_criterion_count: number;
  actions_completed_in_period: number;
  actions_advanced_in_period: number;
  actions_stagnant_in_period: number;
  actions_became_overdue_in_period: number;
  criteria_completed_in_period: number;
}): BimonthlyReportSummary {
  return {
    activeActionCount: Number(row.active_action_count),
    notStartedCount: Number(row.not_started_count),
    inProgressCount: Number(row.in_progress_count),
    completedCount: Number(row.completed_count),
    overdueCount: Number(row.overdue_count),
    cancelledCount: Number(row.cancelled_count),
    averageProgressPercentage: Number(row.average_progress_percentage),
    completedCriterionCount: Number(row.completed_criterion_count),
    pendingCriterionCount: Number(row.pending_criterion_count),
    actionsCompletedInPeriod: Number(row.actions_completed_in_period),
    actionsAdvancedInPeriod: Number(row.actions_advanced_in_period),
    actionsStagnantInPeriod: Number(row.actions_stagnant_in_period),
    actionsBecameOverdueInPeriod: Number(row.actions_became_overdue_in_period),
    criteriaCompletedInPeriod: Number(row.criteria_completed_in_period),
  };
}

export async function listBimonthlyReports(
  client: TypedSupabaseClient,
  cycleId: string,
  referenceYear?: number,
): Promise<BimonthlyHistory> {
  let query = client
    .from("action_plan_bimonthly_reports")
    .select(
      "id, cycle_id, reference_year, bimester, report_version, generation_kind, generated_by, generated_at, closed_at, period_start, period_end, active_action_count, not_started_count, in_progress_count, completed_count, overdue_count, cancelled_count, average_progress_percentage, completed_criterion_count, pending_criterion_count, actions_completed_in_period, actions_advanced_in_period, actions_stagnant_in_period, actions_became_overdue_in_period, criteria_completed_in_period",
    )
    .eq("cycle_id", cycleId)
    .order("reference_year", { ascending: false })
    .order("bimester", { ascending: false })
    .order("report_version", { ascending: false });
  if (referenceYear != null) query = query.eq("reference_year", referenceYear);

  const { data, error } = await query;
  if (error) throw error;

  const history: BimonthlyReportListItem[] = (data ?? []).map((row) => ({
    id: row.id,
    cycleId: row.cycle_id,
    referenceYear: Number(row.reference_year),
    bimester: Number(row.bimester) as Bimester,
    reportVersion: Number(row.report_version),
    generationKind: row.generation_kind === "automatic" ? "automatic" : "manual",
    generatedBy: row.generated_by,
    generatedAt: row.generated_at,
    closedAt: row.closed_at,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    summary: toSummary(row),
  }));

  const seen = new Set<string>();
  const latestByPeriod = history.filter((item) => {
    const key = `${item.referenceYear}:${item.bimester}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { history, latestByPeriod };
}
