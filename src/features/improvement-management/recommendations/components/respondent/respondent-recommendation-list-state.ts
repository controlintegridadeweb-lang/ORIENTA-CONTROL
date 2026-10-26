export type EmptyVariant =
  | "no-recommendations"
  | "no-results"
  | "no-section-results"
  | "no-plan-linked"
  | "awaiting-consolidation";

/** Campos do filtro que decidem se a lista está restrita. */
export type RecommendationListFilterActivity = {
  search: string;
  status: string;
  cycleId: string;
  formId: string;
  axisId: string;
  withPlan: "all" | "with" | "without";
  pendingOnly: boolean;
};

type PlanReadiness = {
  canCreateActionPlan: boolean;
  hasPlan: boolean;
};

/**
 * Na visão do plano, "com plano" é o escopo fixo da tela, não um filtro escolhido.
 * Na análise, o padrão é mostrar todas as recomendações.
 */
export function respondentRecommendationHasActiveFilters(
  actionPlanView: boolean,
  filter: RecommendationListFilterActivity,
): boolean {
  return (
    Boolean(filter.search.trim()) ||
    Boolean(filter.status) ||
    Boolean(filter.cycleId) ||
    Boolean(filter.formId) ||
    Boolean(filter.axisId) ||
    filter.withPlan !== (actionPlanView ? "with" : "all") ||
    filter.pendingOnly
  );
}

/**
 * Escolhe o estado vazio da lista do respondente.
 * Retorna null quando há itens visíveis.
 */
export function resolveRespondentRecommendationEmptyVariant(input: {
  actionPlanView: boolean;
  rows: readonly PlanReadiness[];
  filteredCount: number;
  hasActiveFilters: boolean;
}): EmptyVariant | null {
  if (input.filteredCount > 0) return null;
  if (input.rows.length === 0) return "no-recommendations";
  if (input.actionPlanView && !input.hasActiveFilters) {
    const hasEligibleRecommendationWithoutPlan = input.rows.some(
      (item) => item.canCreateActionPlan && !item.hasPlan,
    );
    const hasRecommendationAwaitingConsolidation = input.rows.some(
      (item) => !item.canCreateActionPlan,
    );
    if (!hasEligibleRecommendationWithoutPlan && hasRecommendationAwaitingConsolidation) {
      return "awaiting-consolidation";
    }
    return "no-plan-linked";
  }
  if (input.hasActiveFilters) {
    return input.actionPlanView ? "no-section-results" : "no-results";
  }
  return "no-recommendations";
}
