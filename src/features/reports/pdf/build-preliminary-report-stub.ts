import type { PreliminaryExportDetail } from "@/features/fami/server";
import type { OfficialReportData } from "@/features/reports/pdf/report-types";

/** Payload mínimo para reutilizar a análise detalhada institucional no PDF preliminar. */
export function buildPreliminaryExportReportData(
  detail: PreliminaryExportDetail,
): OfficialReportData {
  const { checkpoint } = detail;
  const preliminary = checkpoint.preliminary!;

  return {
    cycleId: checkpoint.cycleId,
    cycleProcessingId: checkpoint.id,
    organizationId: "",
    formId: "",
    organizationName: detail.organizationName,
    formName: detail.formName,
    processingVersion: checkpoint.calculationVersion,
    policyVersion: checkpoint.sourcePolicyVersion,
    referenceYear: checkpoint.referenceYear,
    referenceStartYear: checkpoint.referenceYear,
    referenceEndYear: checkpoint.referenceYear,
    referencePeriodLabel: String(checkpoint.referenceYear),
    actionPlanRevision: 0,
    periodLabel: detail.periodLabel,
    famiProcessedAt: checkpoint.calculatedAt,
    generatedAtIso: checkpoint.calculatedAt,
    document: null,
    actionPlan: {
      cycleId: checkpoint.cycleId,
      formId: "",
      formName: detail.formName,
      formVersion: 1,
      organizationId: "",
      organizationName: detail.organizationName,
      axes: [],
      summary: {
        totalRecommendations: 0,
        recommendationsWithActions: 0,
        totalActions: 0,
        actionsByStatus: {},
      },
    },
    diagnostic: {
      criteria: [],
      summary: {
        total: 0,
        evaluated: 0,
        attended: 0,
        notAttended: 0,
        insufficientEvidence: 0,
        notApplicable: 0,
        waived: 0,
      },
      byAxis: [],
    },
    fami: {
      global: {
        percentage: preliminary.percentage,
        maturityLevel: preliminary.maturityLevel,
        pointsObtained: preliminary.pointsObtained,
        pointsPossible: preliminary.pointsPossible,
      },
      byAxis: detail.famiByAxis,
      sections: detail.famiSections,
    },
    actionMovementsByActionId: {},
    evidence: { total: 0, approved: 0, pending: 0, rejected: 0, complementation: 0 },
    evolution: [],
    criticalAxesCount: 0,
    advancedAxesCount: 0,
    topOpportunityAxis: null,
    meta: {
      applicableQuestions: 0,
      waivedQuestions: 0,
      notApplicableResponses: 0,
      isOfficialScore: false,
      cycleState: "open",
      closedAt: checkpoint.closedAt,
      responseDeadlineAt: null,
    },
  };
}
