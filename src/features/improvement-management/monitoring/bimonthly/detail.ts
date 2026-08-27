import "server-only";

import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";
import { workflowStatusLabel } from "@/shared/ui/status-registry";
import { planStatusFromDb, type DbActionPlanStatus } from "@/features/improvement-management";
import type { BimonthlyReportListItem } from "./read";

export type BimonthlyActionSnapshotView = {
  actionPlanId: string;
  recommendationId: string;
  questionVersionId: string;
  sectionId: string;
  axisId: string;
  axisName: string;
  sectionName: string;
  questionPrompt: string;
  recommendationText: string;
  actionText: string;
  responsibleLabel: string;
  startDate: string;
  dueDate: string;
  status: DbActionPlanStatus;
  statusLabel: string;
  progressPercentage: number;
  revision: number;
  effectiveAt: string;
  overdue: boolean;
  hasValidEvidence: boolean;
  approved: boolean;
  approvalEffectiveAt: string | null;
  hasOpenAdjustment: boolean;
  completedInPeriod: boolean;
  advancedInPeriod: boolean;
  stagnantInPeriod: boolean;
  becameOverdueInPeriod: boolean;
  movementsInPeriod: unknown;
};

export type BimonthlyCriterionSnapshotView = {
  questionVersionId: string;
  recommendationId: string;
  sectionId: string;
  axisId: string;
  criterionCompleted: boolean;
  activeActionCount: number;
  completedActionCount: number;
  completedInPeriod: boolean;
};

export type BimonthlyReportDetail = BimonthlyReportListItem & {
  actions: BimonthlyActionSnapshotView[];
  criteria: BimonthlyCriterionSnapshotView[];
};

export async function loadBimonthlyReportDetail(
  client: TypedSupabaseClient,
  reportId: string,
  organizationId?: string,
): Promise<BimonthlyReportDetail | null> {
  let reportQuery = client
    .from("action_plan_bimonthly_reports")
    .select(
      "id, cycle_id, reference_year, bimester, report_version, generation_kind, generated_by, generated_at, closed_at, period_start, period_end, active_action_count, not_started_count, in_progress_count, completed_count, overdue_count, cancelled_count, average_progress_percentage, completed_criterion_count, pending_criterion_count, actions_completed_in_period, actions_advanced_in_period, actions_stagnant_in_period, actions_became_overdue_in_period, criteria_completed_in_period, cycles!inner(organization_id)",
    )
    .eq("id", reportId);
  if (organizationId) {
    reportQuery = reportQuery.eq("cycles.organization_id", organizationId);
  }
  const { data: report, error: reportError } = await reportQuery.maybeSingle();
  if (reportError) throw reportError;
  if (!report) return null;

  const [actionsResult, criteriaResult] = await Promise.all([
    client
      .from("action_plan_bimonthly_action_snapshots")
      .select(
        "action_plan_id, recommendation_id, question_version_id, section_id, axis_id, action_text, responsible_label, start_date, due_date, status, progress_percentage, revision, effective_at, overdue, has_valid_evidence, approved, approval_effective_at, has_open_adjustment, completed_in_period, advanced_in_period, stagnant_in_period, became_overdue_in_period, movements_in_period, question_versions!inner(prompt, section_name, axis_name), recommendations!inner(text)",
      )
      .eq("report_id", reportId),
    client
      .from("action_plan_bimonthly_criterion_snapshots")
      .select(
        "question_version_id, recommendation_id, section_id, axis_id, criterion_completed, active_action_count, completed_action_count, completed_in_period",
      )
      .eq("report_id", reportId),
  ]);
  if (actionsResult.error) throw actionsResult.error;
  if (criteriaResult.error) throw criteriaResult.error;

  const actions: BimonthlyActionSnapshotView[] = (actionsResult.data ?? []).map((row) => {
    const question = Array.isArray(row.question_versions)
      ? row.question_versions[0]
      : row.question_versions;
    const recommendation = Array.isArray(row.recommendations)
      ? row.recommendations[0]
      : row.recommendations;
    const status = row.status;
    return {
      actionPlanId: row.action_plan_id,
      recommendationId: row.recommendation_id,
      questionVersionId: row.question_version_id,
      sectionId: row.section_id,
      axisId: row.axis_id,
      axisName: String(question?.axis_name ?? ""),
      sectionName: String(question?.section_name ?? ""),
      questionPrompt: String(question?.prompt ?? ""),
      recommendationText: String(recommendation?.text ?? ""),
      actionText: row.action_text,
      responsibleLabel: row.responsible_label,
      startDate: row.start_date,
      dueDate: row.due_date,
      status,
      statusLabel: workflowStatusLabel("action_plan", planStatusFromDb(status)),
      progressPercentage: row.progress_percentage,
      revision: Number(row.revision),
      effectiveAt: row.effective_at,
      overdue: row.overdue,
      hasValidEvidence: row.has_valid_evidence,
      approved: row.approved,
      approvalEffectiveAt: row.approval_effective_at,
      hasOpenAdjustment: row.has_open_adjustment,
      completedInPeriod: row.completed_in_period,
      advancedInPeriod: row.advanced_in_period,
      stagnantInPeriod: row.stagnant_in_period,
      becameOverdueInPeriod: row.became_overdue_in_period,
      movementsInPeriod: row.movements_in_period,
    };
  });

  return {
    id: report.id,
    cycleId: report.cycle_id,
    referenceYear: Number(report.reference_year),
    bimester: Number(report.bimester) as BimonthlyReportListItem["bimester"],
    reportVersion: Number(report.report_version),
    generationKind: report.generation_kind === "automatic" ? "automatic" : "manual",
    generatedBy: report.generated_by,
    generatedAt: report.generated_at,
    closedAt: report.closed_at,
    periodStart: report.period_start,
    periodEnd: report.period_end,
    summary: {
      activeActionCount: Number(report.active_action_count),
      notStartedCount: Number(report.not_started_count),
      inProgressCount: Number(report.in_progress_count),
      completedCount: Number(report.completed_count),
      overdueCount: Number(report.overdue_count),
      cancelledCount: Number(report.cancelled_count),
      averageProgressPercentage: Number(report.average_progress_percentage),
      completedCriterionCount: Number(report.completed_criterion_count),
      pendingCriterionCount: Number(report.pending_criterion_count),
      actionsCompletedInPeriod: Number(report.actions_completed_in_period),
      actionsAdvancedInPeriod: Number(report.actions_advanced_in_period),
      actionsStagnantInPeriod: Number(report.actions_stagnant_in_period),
      actionsBecameOverdueInPeriod: Number(report.actions_became_overdue_in_period),
      criteriaCompletedInPeriod: Number(report.criteria_completed_in_period),
    },
    actions,
    criteria: (criteriaResult.data ?? []).map((row) => ({
      questionVersionId: row.question_version_id,
      recommendationId: row.recommendation_id,
      sectionId: row.section_id,
      axisId: row.axis_id,
      criterionCompleted: row.criterion_completed,
      activeActionCount: row.active_action_count,
      completedActionCount: row.completed_action_count,
      completedInPeriod: row.completed_in_period,
    })),
  };
}
