import { countLabel } from "@/shared/format/count-label";
import {
  isSectionRecommendationCompleted,
  type SectionActionPlanGroup,
  type SectionActionPlanRecommendation,
} from "./section-action-plan-model";

export const SECTION_PLAN_EMPTY = {
  treeTitle: "Nenhuma estrutura de problemas e soluções foi registrada para esta seção.",
  treeDescription:
    "A árvore desta seção é derivada das perguntas do diagnóstico, das recomendações e das ações vinculadas.",
  actionsTitle: "Nenhuma ação foi cadastrada para as recomendações desta seção.",
  actionsDescription: "O acompanhamento ficará disponível quando houver ações vinculadas às recomendações.",
  monitoringTitle: "Não há ações para monitorar nesta seção",
  monitoringDescription: "O monitoramento ficará disponível quando houver ações cadastradas.",
} as const;

export function sectionRecommendationSituationSummary(
  recommendations: readonly SectionActionPlanRecommendation[],
): string {
  const completed = recommendations.filter(isSectionRecommendationCompleted).length;
  return [
    countLabel(recommendations.length, "recomendação", "recomendações"),
    countLabel(completed, "concluída", "concluídas"),
  ].join(" · ");
}

export function sectionExecutionSituationSummary(section: SectionActionPlanGroup): string {
  return [
    countLabel(section.recommendations.length, "recomendação", "recomendações"),
    countLabel(section.metrics.totalActions, "ação", "ações"),
    countLabel(section.metrics.completedActions, "concluída", "concluídas"),
  ].join(" · ");
}

export function actionNumberInSection(
  section: SectionActionPlanGroup,
  recommendationIndex: number,
  actionIndex: number,
): number {
  const previousActions = section.recommendations
    .slice(0, recommendationIndex)
    .reduce((total, recommendation) => total + recommendation.actions.length, 0);
  return previousActions + actionIndex + 1;
}
