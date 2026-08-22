import { recommendationTypeLabel } from "@/shared/ui/status-registry";

/**
 * Apresentação do critério de origem a partir do tipo de recomendação
 * já materializado no domínio — sem inferir dados fora do snapshot oficial.
 */
export type OriginCriterionPresentation = {
  questionPrompt: string;
  /** Resposta / condição do diagnóstico que originou a recomendação. */
  originatingAnswer: string;
  /** Situação na validação, em formulação curta para a UI. */
  validationSituation: string | null;
};

const ORIGINATING_ANSWER_BY_TYPE: Record<string, string> = {
  nao_implementacao: "Não",
  ausencia_evidencia: "Sim (sem evidência obrigatória)",
  evidencia_insuficiente: "Sim (com evidência insuficiente ou não aprovada)",
};

/** Textos curtos — evita o parágrafo técnico do registry na Visão geral. */
const VALIDATION_SITUATION_BY_TYPE: Record<string, string> = {
  nao_implementacao: "Resposta negativa no diagnóstico",
  ausencia_evidencia: "Evidência obrigatória não apresentada",
  evidencia_insuficiente: "Evidência insuficiente ou não aprovada",
};

export function presentOriginCriterion(input: {
  questionPrompt: string;
  recommendationType: string;
}): OriginCriterionPresentation {
  const type = input.recommendationType.trim();
  const originatingAnswer =
    ORIGINATING_ANSWER_BY_TYPE[type] ?? recommendationTypeLabel(type);
  const validationSituation = VALIDATION_SITUATION_BY_TYPE[type] ?? null;

  return {
    questionPrompt: input.questionPrompt.trim(),
    originatingAnswer,
    validationSituation,
  };
}
