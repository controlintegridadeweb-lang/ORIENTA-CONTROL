import type { FamiLevel } from "@/features/fami/respondent-presentation";
import {
  FAMI_WEIGHTS,
  formatFamiPoints,
} from "@/shared/domain/fami-policy";

/** Faixas de percentual → nível (espelha `shared/domain/fami-policy.ts`). */
export const FAMI_LEVEL_THRESHOLDS: { level: FamiLevel; range: string }[] = [
  { level: 1, range: "0% a 20%" },
  { level: 2, range: "Acima de 20% até 40%" },
  { level: 3, range: "Acima de 40% até 60%" },
  { level: 4, range: "Acima de 60% até 80%" },
  { level: 5, range: "Acima de 80% até 100%" },
];

/** Resumo curto por nível (jornada visual). */
export const FAMI_MATURITY_JOURNEY_SUMMARY: Record<FamiLevel, string> = {
  1: "Práticas pontuais e pouca estrutura institucional.",
  2: "Processos em formalização e evidências em construção.",
  3: "Práticas regulares e governança mais consistente.",
  4: "Processos consolidados, evidências auditáveis e monitoramento.",
  5: "Governança institucionalizada, métricas e melhoria contínua.",
};

/** PNG por nível em `public/assets/fami-levels/`. */
export function famiLevelIllustrationPath(level: FamiLevel): string {
  return `/assets/fami-levels/level-${level}.png`;
}

export const FAMI_GUIDE_INTRO =
  "Entenda em poucos passos como o Resultado FAMI é calculado.";

const weightNoEvidence = formatFamiPoints(FAMI_WEIGHTS.WITHOUT_REQUIRED_EVIDENCE);
const weightApproved = formatFamiPoints(
  FAMI_WEIGHTS.WITH_REQUIRED_EVIDENCE_APPROVED,
);

/** Etapas didáticas do guia “Como o FAMI funciona”. */
export const FAMI_EXPLAIN_CARDS = [
  {
    id: "what",
    title: "O que é o FAMI",
    description:
      "Ferramenta de Avaliação da Maturidade em Integridade (FAMI). Resultado de maturidade de um processamento concluído do diagnóstico.",
  },
  {
    id: "how",
    title: "Como a pontuação é calculada",
    description: "Percentual com base nos pontos obtidos e possíveis.",
  },
  {
    id: "sync",
    title: "Quando o FAMI é calculado",
    description:
      "O resultado do FAMI é definido após a conclusão da validação do diagnóstico.",
  },
] as const;

/** Regras de pontuação agrupadas (card “Como”). Espelha `shared/domain/fami-policy` v7. */
export const FAMI_SCORING_GROUPS = [
  {
    id: "evidence",
    title: `${weightApproved} pontos — Comprovação aprovada`,
    items: [
      "Resposta Sim em critério que exige evidência, com comprovação aprovada.",
    ],
  },
  {
    id: "yes",
    title: `${weightNoEvidence} ponto — Sem necessidade de comprovação`,
    items: ["Resposta Sim em critério que não exige evidência."],
  },
  {
    id: "zero",
    title: "0 pontos — Não atendido ou sem comprovação aprovada",
    items: [
      "Resposta Não.",
      "Resposta Sim em critério que exige evidência, mas sem comprovação aprovada.",
    ],
  },
  {
    id: "excluded",
    title: "Fora do cálculo",
    items: ["Não se aplica, quando aceito pela equipe de validação."],
  },
] as const;
