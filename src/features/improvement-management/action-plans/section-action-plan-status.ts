import type {
  SectionActionPlanMetrics,
  SectionActionPlanRecommendation,
} from "./section-action-plan-model";

export type SectionPlanStatus =
  | "empty"
  | "not_started"
  | "in_progress"
  | "attention"
  | "awaiting_acceptance"
  | "completed";

function countByStatus(recommendations: readonly SectionActionPlanRecommendation[]) {
  const counts = {
    generated: 0,
    in_action_plan: 0,
    awaiting_approval: 0,
    adjustment_requested: 0,
    exception_requested: 0,
    completed: 0,
    dismissed: 0,
  };
  for (const recommendation of recommendations) {
    counts[recommendation.recommendationStatus] += 1;
  }
  return counts;
}

/**
 * Situação gerencial da seção.
 * O percentual de execução continua vindo só das ações cadastradas; o status
 * também considera recomendações sem tratamento e o aceite administrativo.
 */
export function sectionPlanStatusFromSection(section: {
  recommendations: readonly SectionActionPlanRecommendation[];
  metrics: SectionActionPlanMetrics;
}): SectionPlanStatus {
  const counts = countByStatus(section.recommendations);
  const untreated =
    counts.generated +
    counts.in_action_plan +
    counts.adjustment_requested +
    counts.exception_requested;
  const settled = counts.completed + counts.dismissed;

  if (untreated === 0 && counts.awaiting_approval === 0) {
    if (counts.completed > 0 && settled === section.recommendations.length) return "completed";
    if (section.recommendations.length === 0 || settled === section.recommendations.length) {
      return "empty";
    }
  }
  if (untreated === 0 && counts.awaiting_approval > 0) return "awaiting_acceptance";
  if (section.metrics.overdueActions > 0) return "attention";
  if (
    counts.in_action_plan > 0 ||
    counts.adjustment_requested > 0 ||
    counts.exception_requested > 0 ||
    counts.awaiting_approval > 0 ||
    section.metrics.inProgressActions > 0 ||
    section.metrics.completedActions > 0
  ) {
    return "in_progress";
  }
  if (section.metrics.activeActions === 0) return "empty";
  return "not_started";
}

/** Fallback sem situação das recomendações — nunca afirma conclusão aceita. */
export function sectionPlanStatusFromMetrics(metrics: SectionActionPlanMetrics): SectionPlanStatus {
  if (metrics.activeActions === 0) return "empty";
  if (metrics.overdueActions > 0) return "attention";
  if (metrics.inProgressActions > 0 || metrics.completedActions > 0) return "in_progress";
  return "not_started";
}
