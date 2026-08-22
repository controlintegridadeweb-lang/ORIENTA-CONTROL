import { isEligibleForRecommendation } from "./fami";
import type {
  QuestionInput,
  RecommendationType,
  RecommendationTrigger,
  AdminProofStatus,
} from "./types";

export type InferRecommendationInput = Pick<
  QuestionInput,
  | "answer"
  | "requiresEvidence"
  | "validationStatus"
  | "adminProofStatus"
  | "isNotApplicable"
  | "famiEnabled"
  | "appliesToRespondent"
  | "waived"
  | "hasEvidence"
>;

export type RecommendationDetail = {
  tipo: RecommendationType;
  trigger: RecommendationTrigger;
};

function isInsufficientDecision(
  input: Pick<InferRecommendationInput, "validationStatus" | "adminProofStatus">,
): boolean {
  if (input.adminProofStatus === "considered_insufficient") return true;
  return input.validationStatus === "invalidated";
}

/**
 * Espelho puro dos gatilhos materializáveis por
 * `calculate_live_recommendations`:
 *
 * 1. resposta “Não” → não implementação;
 * 2. decisão de insuficiência (com ou sem documento) → evidência insuficiente;
 * 3. evidência exigida ausente (sem decisão de insuficiência) → ausência.
 *
 * Evidências pendentes ou aguardando ajuste bloqueiam a consolidação e, por
 * isso, nunca originam recomendação oficial antes de receber um parecer final.
 * “Não se aplica” nunca gera recomendação por este motor.
 */
export function inferRecommendationDetail(
  input: InferRecommendationInput,
): RecommendationDetail | null {
  if (!isEligibleForRecommendation(input as QuestionInput)) return null;

  if (input.answer === "no") {
    return { tipo: "nao_implementacao", trigger: "resposta_nao" };
  }

  if (input.answer !== "yes" || !input.requiresEvidence) return null;

  if (isInsufficientDecision(input)) {
    return { tipo: "evidencia_insuficiente", trigger: "evidencia_invalida" };
  }

  if (!input.hasEvidence) {
    return { tipo: "ausencia_evidencia", trigger: "evidencia_ausente" };
  }

  return null;
}

export type { AdminProofStatus };
