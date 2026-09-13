import { countLabel } from "@/shared/format/count-label";
import type { RecommendationStatus } from "@/shared/domain/recommendation-status";
import type {
  SectionActionPlanGroup,
  SectionActionPlanRecommendation,
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

const SITUATION_PARTS: Array<{
  status: RecommendationStatus;
  singular: string;
  plural: string;
}> = [
  { status: "generated", singular: "sem ação", plural: "sem ação" },
  { status: "in_action_plan", singular: "em execução", plural: "em execução" },
  { status: "adjustment_requested", singular: "ajuste solicitado", plural: "ajustes solicitados" },
  { status: "exception_requested", singular: "exceção em análise", plural: "exceções em análise" },
  { status: "awaiting_approval", singular: "aguardando aceite", plural: "aguardando aceite" },
  { status: "completed", singular: "concluída", plural: "concluídas" },
  { status: "dismissed", singular: "dispensada", plural: "dispensadas" },
];

export function sectionRecommendationSituationSummary(
  recommendations: readonly SectionActionPlanRecommendation[],
): string {
  const parts = [countLabel(recommendations.length, "recomendação", "recomendações")];
  for (const { status, singular, plural } of SITUATION_PARTS) {
    const count = recommendations.filter((item) => item.recommendationStatus === status).length;
    if (count > 0) parts.push(countLabel(count, singular, plural));
  }
  return parts.join(" · ");
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
