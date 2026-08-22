import { ActionPlansQueryService } from "@/features/improvement-management/server";
import { levelMeta } from "@/features/fami";
import { createSupabaseServiceRoleClient, type TypedSupabaseClient } from "@/infrastructure/supabase/server";
import {
  loadCycleEvidenceSummary,
  loadCycleDiagnosticResults,
  loadCycleFamiReportSnapshot,
  resolveCycleReportScope,
  resolveLatestCycleFamiVersion,
} from "./cycle-report-read";
import { loadCycleFamiEvolutionByReferencePeriod } from "./cycle-report-evolution-read";
import { loadActionPlanMovementsByActionId } from "./load-action-plan-movements";
import { loadProcessingFamiQuestionMeta } from "@/features/fami/server";
import type { OfficialReportData } from "./report-types";

export type { OfficialReportData } from "./report-types";

/**
 * Payload canônico para PDF institucional. A entrada é exclusivamente o
 * `cycleId`; formulário, organização e processamento são derivados no servidor.
 */
export async function loadOfficialReportData(params: {
  cycleId: string;
  processingVersion?: number;
}, client?: TypedSupabaseClient): Promise<OfficialReportData | null> {
  const supabase = client ?? createSupabaseServiceRoleClient();
  const scope = await resolveCycleReportScope(supabase, params.cycleId);
  if (!scope) return null;

  const processingVersion =
    params.processingVersion ??
    (await resolveLatestCycleFamiVersion(supabase, scope.cycleId));
  if (processingVersion == null) return null;

  const fami = await loadCycleFamiReportSnapshot(
    supabase,
    scope.cycleId,
    processingVersion,
  );
  if (!fami?.global || fami.processingStatus !== "completed") return null;

  if (scope.referenceStartYear == null || scope.referenceEndYear == null) {
    throw new Error("report_reference_period_unresolved");
  }

  const plansService = new ActionPlansQueryService(supabase);
  const [evidence, evolution, meta, actionPlan, diagnostic] = await Promise.all([
    loadCycleEvidenceSummary(supabase, fami.cycleProcessingId),
    // A evolução do PDF histórico não pode incluir processamentos posteriores
    // à versão selecionada.
    loadCycleFamiEvolutionByReferencePeriod(supabase, scope, {
      id: fami.cycleProcessingId,
      version: fami.processingVersion,
    }),
    loadProcessingFamiQuestionMeta(supabase, {
      formVersionId: scope.formVersionId,
      cycleProcessingId: fami.cycleProcessingId,
    }),
    plansService.getByProcessing(scope.cycleId, fami.cycleProcessingId, {
      role: "admin",
      organizationId: null,
    }),
    loadCycleDiagnosticResults(supabase, {
      cycleProcessingId: fami.cycleProcessingId,
      formVersionId: scope.formVersionId,
    }),
  ]);
  if (!actionPlan) return null;

  if (scope.cycleState === "completed") {
    const unresolvedRecommendations = actionPlan.axes.flatMap((axis) =>
      axis.recommendations.filter(
        (recommendation) =>
          recommendation.recommendationStatus !== "completed" &&
          recommendation.recommendationStatus !== "dismissed",
      ),
    );
    if (unresolvedRecommendations.length > 0) {
      throw new Error("report_action_plan_not_closed");
    }
  }

  const actionPlanIds = actionPlan.axes.flatMap((axis) =>
    axis.recommendations.flatMap((recommendation) =>
      recommendation.actions.map((action) => action.id),
    ),
  );
  const actionMovementsByActionId = await loadActionPlanMovementsByActionId(
    supabase,
    actionPlanIds,
  );

  const byAxis = fami.axes.map((axis) => ({
    axisId: axis.axisId ?? null,
    axisName: axis.axisName,
    percentage: axis.percentage,
    maturityLevel: axis.maturityLevel,
    pointsObtained: axis.pointsObtained,
    pointsPossible: axis.pointsPossible,
  }));
  const applicableAxes = byAxis.filter((axis) => axis.maturityLevel != null);
  const sortedAxes = [...applicableAxes].sort((a, b) => a.percentage - b.percentage);
  const bottom = sortedAxes[0];

  return {
    cycleId: scope.cycleId,
    cycleProcessingId: fami.cycleProcessingId,
    organizationId: scope.organizationId,
    formId: scope.formId,
    organizationName: scope.organizationName,
    formName: scope.formName,
    processingVersion,
    policyVersion: fami.policyVersion,
    referenceYear: scope.referenceStartYear,
    referenceStartYear: scope.referenceStartYear,
    referenceEndYear: scope.referenceEndYear,
    actionPlanRevision: scope.actionPlanRevision,
    referencePeriodLabel:
      scope.referenceStartYear === scope.referenceEndYear
        ? String(scope.referenceStartYear)
        : `${scope.referenceStartYear}–${scope.referenceEndYear}`,
    periodLabel: scope.periodLabel,
    famiProcessedAt: fami.global.createdAt || new Date().toISOString(),
    generatedAtIso: new Date().toISOString(),
    document: null,
    actionPlan,
    diagnostic,
    fami: {
      global: {
        percentage: fami.global.percentage,
        maturityLevel: fami.global.maturityLevel,
        pointsObtained: fami.global.pointsObtained,
        pointsPossible: fami.global.pointsPossible,
      },
      byAxis,
      sections: fami.sections,
    },
    actionMovementsByActionId,
    evidence,
    evolution,
    criticalAxesCount: applicableAxes.filter((axis) => axis.percentage < 50).length,
    advancedAxesCount: applicableAxes.filter((axis) => axis.percentage >= 75).length,
    topOpportunityAxis:
      bottom && sortedAxes.length > 1 && bottom.percentage < 75
        ? bottom.axisName
        : null,
    meta: {
      applicableQuestions: meta.applicableQuestions,
      waivedQuestions: meta.waivedQuestions,
      notApplicableResponses: meta.notApplicableResponses,
      isOfficialScore: true,
      cycleState: scope.cycleState,
      closedAt: fami.processingCompletedAt,
      responseDeadlineAt: scope.responseDeadlineAt,
    },
  };
}

/** Rótulo institucional do nível FAMI para o PDF. */
export function reportLevelLabel(level: number | null): string {
  return level == null ? "N/A" : levelMeta(level).label;
}
