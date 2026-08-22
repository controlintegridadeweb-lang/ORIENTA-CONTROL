import { structuralAxisOrderIndex } from "@/shared/domain/axis";
import type { ActionPlanAction, ActionPlanRecommendationNode } from "@/features/improvement-management";
import { calculatePlanProgress } from "@/features/improvement-management";
import { levelMeta } from "@/features/fami";
import {
  recommendationTypeLabel,
  RECOMMENDATION_REGISTRY,
  ACTION_PLAN_REGISTRY,
} from "@/shared/ui/status-registry";
import type {
  OfficialReportData,
  ReportActionMovementSource,
  ReportActionView,
  ReportAxisView,
  ReportDetailedAnalysisView,
  ReportDiagnosticCriterion,
  ReportDiagnosticResult,
  ReportFamiSectionScore,
  ReportMovementView,
  ReportRecommendationView,
  ReportSectionView,
} from "@/features/reports/pdf/report-types";

export const DETAILED_ANALYSIS_CHAPTER_NUMBER = 5;

export const REPORT_EMPTY_SECTION_RECOMMENDATIONS =
  "Nenhuma recomendação foi gerada para esta seção.";

export const REPORT_EMPTY_SECTION_ACTIONS =
  "Ainda não há ações cadastradas para o plano desta seção.";
/** @deprecated: use REPORT_EMPTY_SECTION_ACTIONS. */
export const REPORT_EMPTY_RECOMMENDATION_ACTIONS = REPORT_EMPTY_SECTION_ACTIONS;

export const REPORT_EMPTY_ACTION_MOVEMENTS =
  "Nenhuma movimentação registrada para esta ação.";

const DIAGNOSTIC_RESULT_LABELS: Record<ReportDiagnosticResult, string> = {
  attended: "Atendido",
  not_attended: "Não atendido",
  insufficient_evidence: "Evidência insuficiente",
  not_applicable: "Não se aplica",
  waived: "Não aplicável à organização",
};

const ANSWER_LABELS: Record<NonNullable<ReportDiagnosticCriterion["answer"]>, string> = {
  yes: "Sim",
  no: "Não",
  not_applicable: "Não se aplica",
};

function answerLabel(answer: ReportDiagnosticCriterion["answer"]): string {
  if (answer == null) return "Dispensada — sem resposta exigida";
  return ANSWER_LABELS[answer];
}

function axisSortKey(name: string): number {
  return structuralAxisOrderIndex(name);
}

function criterionMatchKey(axisName: string, sectionName: string, prompt: string): string {
  return `${axisName.trim()}\u0000${sectionName.trim()}\u0000${prompt.trim()}`;
}

function formatDateLabel(iso: string): string {
  const day = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const [y, m, d] = day.split("-");
    return `${d}/${m}/${y}`;
  }
  return iso;
}

function formatProgressTransition(previous: number, next: number): string {
  return `${previous}% -> ${next}%`;
}

function actionStatusLabel(action: ActionPlanAction): string {
  if (action.status === "cancelled") return "Cancelada";
  if (action.progressPercentage === 0) return "Não iniciada";
  if (action.progressPercentage === 100) return "Concluída";
  return ACTION_PLAN_REGISTRY.in_progress.label;
}

function recommendationStatusLabel(
  recommendation: ActionPlanRecommendationNode,
): string {
  const status = recommendation.recommendationStatus;
  if (status === "generated") return "Aguardando cadastro de ações";
  if (status === "completed") return "Concluída";
  if (status === "in_action_plan") {
    const active = recommendation.actions.filter((action) => action.status !== "cancelled");
    if (active.length > 0 && active.every((action) => action.progressPercentage === 0)) {
      return "Ações em elaboração";
    }
    return "Em acompanhamento";
  }
  return RECOMMENDATION_REGISTRY[status]?.label ?? status;
}

function reasonLabelFor(
  recommendation: ActionPlanRecommendationNode,
  criterion: ReportDiagnosticCriterion | null,
): string {
  const typeLabel = recommendationTypeLabel(recommendation.recommendationType);
  if (
    criterion?.notApplicableRejectionReason?.trim() &&
    recommendation.recommendationType === "nao_implementacao"
  ) {
    return "Não se aplica não aceito";
  }
  return typeLabel;
}

function sortActionsForReport(actions: ActionPlanAction[]): ActionPlanAction[] {
  return [...actions].sort((a, b) => {
    const byUpdated = String(a.updatedAt).localeCompare(String(b.updatedAt));
    if (byUpdated !== 0) return byUpdated;
    return a.id.localeCompare(b.id);
  });
}

function sortMovements(
  movements: ReportActionMovementSource[],
): ReportActionMovementSource[] {
  return [...movements].sort((a, b) => {
    const byDate = String(a.createdAt).localeCompare(String(b.createdAt));
    if (byDate !== 0) return byDate;
    return a.id.localeCompare(b.id);
  });
}

function buildMovementsView(
  action: ActionPlanAction,
  movements: ReportActionMovementSource[],
): ReportMovementView[] {
  const seen = new Set<string>();
  const ordered = sortMovements(movements);
  const views: ReportMovementView[] = [];
  for (const movement of ordered) {
    if (seen.has(movement.id)) continue;
    seen.add(movement.id);
    views.push({
      id: movement.id,
      dateLabel: formatDateLabel(movement.createdAt),
      actionTitle: action.actionText,
      progressLabel: formatProgressTransition(
        movement.previousPercentage,
        movement.newPercentage,
      ),
      updateText: movement.description?.trim() || "Atualização de progresso registrada.",
      responsibleLabel: movement.responsibleLabel.trim() || "Responsável não informado",
      createdAtIso: movement.createdAt,
    });
  }
  return views;
}

function buildActionView(
  action: ActionPlanAction,
  numberLabel: string,
  origin: {
    recommendation: ActionPlanRecommendationNode;
    recommendationNumberLabel: string;
    criterion: ReportDiagnosticCriterion | null;
  },
  movementsByActionId: Record<string, ReportActionMovementSource[]>,
): ReportActionView {
  const responsible = [action.responsibleName, action.responsibleSector]
    .filter(Boolean)
    .join(" · ");
  return {
    id: action.id,
    numberLabel,
    title: action.actionText,
    responsibleLabel: responsible || "Responsável não informado",
    startLabel: action.startDate ? formatDateLabel(action.startDate) : "não informado",
    endLabel: action.dueDate ? formatDateLabel(action.dueDate) : "não informado",
    progressPercentage: action.progressPercentage,
    statusLabel: actionStatusLabel(action),
    isOverdue: action.slaLabel === "overdue",
    isCancelled: action.status === "cancelled",
    originRecommendationId: origin.recommendation.recommendationId,
    originRecommendationNumberLabel: origin.recommendationNumberLabel,
    originRecommendationText: origin.recommendation.recommendationText,
    originCriterion: origin.criterion?.prompt ?? origin.recommendation.questionPrompt,
    movements: buildMovementsView(action, movementsByActionId[action.id] ?? []),
  };
}

function buildRecommendationView(
  recommendation: ActionPlanRecommendationNode,
  criterion: ReportDiagnosticCriterion | null,
  numberLabel: string,
  axisName: string,
  sectionName: string,
): ReportRecommendationView {
  return {
    id: recommendation.recommendationId,
    numberLabel,
    diagnosisLabel: criterion ? DIAGNOSTIC_RESULT_LABELS[criterion.result] : "Diagnóstico",
    axisName,
    sectionName,
    originCriterion: criterion?.prompt ?? recommendation.questionPrompt,
    answerLabel: criterion ? answerLabel(criterion.answer) : "-",
    adminAnalysisLabel: criterion ? DIAGNOSTIC_RESULT_LABELS[criterion.result] : null,
    reasonLabel: reasonLabelFor(recommendation, criterion),
    recommendationText: recommendation.recommendationText,
    statusLabel: recommendationStatusLabel(recommendation),
  };
}

function sectionActionPlanStatusLabel(metrics: {
  activeActions: number;
  completedActions: number;
  overdueActions: number;
  inProgressActions: number;
}): string {
  if (metrics.activeActions === 0) return "Sem ações ativas";
  if (metrics.completedActions === metrics.activeActions) return "Concluído";
  if (metrics.overdueActions > 0) return "Requer atenção";
  if (metrics.inProgressActions > 0 || metrics.completedActions > 0) return "Em execução";
  return "Não iniciado";
}

function buildSectionActionPlanSummary(actions: ReportActionView[]) {
  let activeActions = 0;
  let notStartedActions = 0;
  let inProgressActions = 0;
  let completedActions = 0;
  let cancelledActions = 0;
  let overdueActions = 0;
  let progressSum = 0;
  for (const action of actions) {
    if (action.isCancelled) {
      cancelledActions += 1;
      continue;
    }
    activeActions += 1;
    progressSum += action.progressPercentage;
    if (action.progressPercentage >= 100) completedActions += 1;
    else if (action.progressPercentage > 0) inProgressActions += 1;
    else notStartedActions += 1;
    if (action.isOverdue && action.progressPercentage < 100) overdueActions += 1;
  }
  const metrics = {
    totalActions: actions.length,
    activeActions,
    notStartedActions,
    inProgressActions,
    completedActions,
    cancelledActions,
    overdueActions,
    progressPercentage: activeActions === 0 ? 0 : Math.round(progressSum / activeActions),
  };
  return { ...metrics, statusLabel: sectionActionPlanStatusLabel(metrics) };
}

type SectionBucket = {
  id: string;
  title: string;
  order: number;
  criteria: ReportDiagnosticCriterion[];
  recommendations: Array<{
    recommendation: ActionPlanRecommendationNode;
    criterion: ReportDiagnosticCriterion | null;
    criterionOrder: number;
  }>;
};

type AxisBucket = {
  id: string;
  title: string;
  order: number;
  sections: Map<string, SectionBucket>;
};

function ensureAxis(axes: Map<string, AxisBucket>, axisId: string, axisName: string): AxisBucket {
  const key = axisId || `__name:${axisName}`;
  let bucket = axes.get(key);
  if (!bucket) {
    bucket = {
      id: axisId || key,
      title: axisName,
      order: axisSortKey(axisName),
      sections: new Map(),
    };
    axes.set(key, bucket);
  }
  return bucket;
}

function ensureSection(
  axis: AxisBucket,
  sectionId: string,
  sectionName: string,
  sectionOrder: number,
): SectionBucket {
  const key = sectionId || `__name:${sectionName}`;
  let bucket = axis.sections.get(key);
  if (!bucket) {
    bucket = {
      id: sectionId || key,
      title: sectionName,
      order: sectionOrder,
      criteria: [],
      recommendations: [],
    };
    axis.sections.set(key, bucket);
  } else if (sectionOrder < bucket.order) {
    bucket.order = sectionOrder;
  }
  return bucket;
}

function findSectionScore(
  sections: ReportFamiSectionScore[],
  sectionId: string,
  sectionName: string,
): ReportFamiSectionScore | null {
  return (
    sections.find((section) => section.sectionId === sectionId) ??
    sections.find((section) => section.sectionName === sectionName) ??
    null
  );
}

/**
 * Monta o view model Eixo → Seção → Plano da seção → Ações, mantendo a recomendação como origem rastreável,
 * com ordenação oficial e numeração determinística de apresentação.
 */
export function prepareDetailedAnalysis(
  data: OfficialReportData,
): ReportDetailedAnalysisView {
  const axesMap = new Map<string, AxisBucket>();
  const criterionByKey = new Map<string, ReportDiagnosticCriterion>();

  for (const criterion of data.diagnostic.criteria) {
    criterionByKey.set(
      criterionMatchKey(criterion.axisName, criterion.sectionName, criterion.prompt),
      criterion,
    );
    const axis = ensureAxis(axesMap, criterion.axisId, criterion.axisName);
    const section = ensureSection(
      axis,
      criterion.sectionId,
      criterion.sectionName,
      criterion.sectionOrder,
    );
    section.criteria.push(criterion);
  }

  for (const famiAxis of data.fami.byAxis) {
    ensureAxis(axesMap, famiAxis.axisId ?? "", famiAxis.axisName);
  }

  for (const actionAxis of data.actionPlan.axes) {
    const axis = ensureAxis(axesMap, actionAxis.axisId, actionAxis.axisName);
    for (const recommendation of actionAxis.recommendations) {
      const key = criterionMatchKey(
        actionAxis.axisName,
        recommendation.sectionName,
        recommendation.questionPrompt,
      );
      const criterion = criterionByKey.get(key) ?? null;
      const section = ensureSection(
        axis,
        criterion?.sectionId ?? recommendation.sectionName,
        recommendation.sectionName || criterion?.sectionName || "Seção",
        criterion?.sectionOrder ?? Number.MAX_SAFE_INTEGER / 2,
      );
      section.recommendations.push({
        recommendation,
        criterion,
        criterionOrder: criterion?.orderIndex ?? Number.MAX_SAFE_INTEGER,
      });
    }
  }

  const orderedAxes = [...axesMap.values()].sort(
    (a, b) => a.order - b.order || a.title.localeCompare(b.title, "pt-BR"),
  );

  const axisViews: ReportAxisView[] = orderedAxes.map((axis, axisIndex) => {
    const axisNumber = `${DETAILED_ANALYSIS_CHAPTER_NUMBER}.${axisIndex + 1}`;
    const famiAxis =
      data.fami.byAxis.find((item) => item.axisId && item.axisId === axis.id) ??
      data.fami.byAxis.find((item) => item.axisName === axis.title) ??
      null;
    const diagnosticAxis = data.diagnostic.byAxis.find(
      (item) => item.axisId === axis.id || item.axisName === axis.title,
    );

    const orderedSections = [...axis.sections.values()].sort(
      (a, b) => a.order - b.order || a.title.localeCompare(b.title, "pt-BR"),
    );

    const sectionViews: ReportSectionView[] = orderedSections.map((section, sectionIndex) => {
      const sectionNumber = `${axisNumber}.${sectionIndex + 1}`;
      const sectionScore = findSectionScore(
        data.fami.sections,
        section.id,
        section.title,
      );

      const orderedRecs = [...section.recommendations].sort((a, b) => {
        const byCriterion = a.criterionOrder - b.criterionOrder;
        if (byCriterion !== 0) return byCriterion;
        return a.recommendation.recommendationId.localeCompare(
          b.recommendation.recommendationId,
        );
      });

      const uniqueEntries: typeof orderedRecs = [];
      const seenRecIds = new Set<string>();
      for (const entry of orderedRecs) {
        if (seenRecIds.has(entry.recommendation.recommendationId)) continue;
        seenRecIds.add(entry.recommendation.recommendationId);
        uniqueEntries.push(entry);
      }

      const recommendationViews = uniqueEntries.map((entry, recIndex) =>
        buildRecommendationView(
          entry.recommendation,
          entry.criterion,
          `${sectionNumber}.${recIndex + 1}`,
          axis.title,
          section.title,
        ),
      );

      const actions: ReportActionView[] = [];
      uniqueEntries.forEach((entry, recIndex) => {
        const recommendationNumber = `${sectionNumber}.${recIndex + 1}`;
        for (const action of sortActionsForReport(entry.recommendation.actions)) {
          actions.push(
            buildActionView(
              action,
              `${sectionNumber}-A${actions.length + 1}`,
              {
                recommendation: entry.recommendation,
                recommendationNumberLabel: recommendationNumber,
                criterion: entry.criterion,
              },
              data.actionMovementsByActionId,
            ),
          );
        }
      });
      const actionPlanSummary = buildSectionActionPlanSummary(actions);

      return {
        id: section.id,
        numberLabel: sectionNumber,
        title: section.title,
        order: section.order,
        summary: {
          name: section.title,
          pointsObtained: sectionScore?.pointsObtained ?? null,
          pointsPossible: sectionScore?.pointsPossible ?? null,
          percentage: sectionScore?.percentage ?? null,
          criteriaCount: section.criteria.length,
          recommendationsCount: recommendationViews.length,
          actionsCount: actions.length,
        },
        recommendations: recommendationViews,
        actionPlan: {
          summary: actionPlanSummary,
          actions,
        },
      };
    });

    const allActions = sectionViews.flatMap((section) =>
      section.actionPlan.actions.map((action) => ({
        progressPercentage: action.progressPercentage,
        status: action.isCancelled ? ("cancelled" as const) : ("in_progress" as const),
      })),
    );
    // calculatePlanProgress ignora canceladas; status só precisa distinguir cancelled.
    const averageActionProgress =
      allActions.length > 0 ? calculatePlanProgress(allActions) : null;

    return {
      id: axis.id,
      numberLabel: axisNumber,
      title: axis.title,
      order: axis.order,
      summary: {
        name: axis.title,
        pointsObtained: famiAxis?.pointsObtained ?? null,
        pointsPossible: famiAxis?.pointsPossible ?? null,
        percentage: famiAxis?.percentage ?? null,
        maturityLabel:
          famiAxis?.maturityLevel != null ? levelMeta(famiAxis.maturityLevel).label : null,
        applicableCriteriaCount: diagnosticAxis?.evaluated ?? diagnosticAxis?.total ?? 0,
        sectionsCount: sectionViews.length,
        sectionsWithActionPlan: sectionViews.filter((section) => section.actionPlan.actions.length > 0).length,
        recommendationsCount: sectionViews.reduce(
          (total, section) => total + section.summary.recommendationsCount,
          0,
        ),
        actionsCount: sectionViews.reduce(
          (total, section) => total + section.summary.actionsCount,
          0,
        ),
        averageActionProgress,
      },
      sections: sectionViews,
    };
  });

  return {
    chapterNumber: DETAILED_ANALYSIS_CHAPTER_NUMBER,
    axes: axisViews,
  };
}

/** Extrai a sequência linear de IDs para asserts de vínculo e não-duplicação. */
export function flattenDetailedAnalysisIds(view: ReportDetailedAnalysisView): {
  recommendationIds: string[];
  actionIds: string[];
  movementIds: string[];
  numberLabels: string[];
} {
  const recommendationIds: string[] = [];
  const actionIds: string[] = [];
  const movementIds: string[] = [];
  const numberLabels: string[] = [];

  for (const axis of view.axes) {
    numberLabels.push(axis.numberLabel);
    for (const section of axis.sections) {
      numberLabels.push(section.numberLabel);
      for (const recommendation of section.recommendations) {
        recommendationIds.push(recommendation.id);
        numberLabels.push(recommendation.numberLabel);
      }
      for (const action of section.actionPlan.actions) {
        actionIds.push(action.id);
        numberLabels.push(action.numberLabel);
        for (const movement of action.movements) {
          movementIds.push(movement.id);
        }
      }
    }
  }

  return { recommendationIds, actionIds, movementIds, numberLabels };
}
