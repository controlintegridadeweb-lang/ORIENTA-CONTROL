import type { AnswerValue, ValidationStatus } from "./types";

/**
 * Predicados de elegibilidade e prontidão para envio (6.4 linha "in_response→
 * submitted"; predicados de 6.1 linha 211).
 *
 * O documento define dois predicados distintos, ambos de domínio puro:
 *   is_eligible_for_recommendation = applies_to_respondent ∧ ¬is_not_applicable ∧ ¬waiver
 *   is_scored_for_fami             = is_eligible_for_recommendation ∧ fami_enabled
 *
 * A completude do ENVIO se apoia na elegibilidade: um critério precisa estar
 * respondido somente se for elegível. Em perguntas com evidência obrigatória,
 * a ausência do anexo não bloqueia o envio: sem aprovação o obtido fica 0
 * (peso possível 2,0 na política v7) e só chega a 2,0 com evidência aprovada; a
 * não conformidade documental gera recomendação na consolidação.
 */

/** Entrada mínima para avaliar elegibilidade e completude de um critério. */
export type SubmissionQuestion = {
  questionId: string;
  appliesToRespondent: boolean;
  isNotApplicable: boolean;
  hasWaiver: boolean;
  famiEnabled: boolean;
  requiresEvidence: boolean;
  /** null/undefined = ainda sem resposta. */
  answer: AnswerValue | null | undefined;
  /** Há ao menos uma evidência ativa anexada (qualquer veredito). */
  hasActiveEvidence: boolean;
  validationStatus?: ValidationStatus;
  /** Quantidade de evidências devolvidas pela administração. */
  adjustmentRequestCount?: number;
  /** Quantidade de devolutivas já atendidas por evidências novas e distintas. */
  resolvedAdjustmentRequestCount?: number;
  /** Quantidade de devolutivas ainda sem substituição própria. */
  unresolvedAdjustmentRequestCount?: number;
  /** Todas as devolutivas já possuem uma evidência substituta própria. */
  hasResolvedAllAdjustments?: boolean;
  /** Administração pediu comprovação sem documento prévio. */
  proofRequested?: boolean;
};

/**
 * Elegível para diagnóstico/recomendação: o respondente o vê e ele conta como
 * "deveria estar respondido". applies_to_respondent ∧ ¬is_not_applicable ∧ ¬waiver.
 * `isNotApplicable` deve ser o N/A efetivo (aprovado pela administração).
 */
export function isEligibleForRecommendation(q: SubmissionQuestion): boolean {
  return q.appliesToRespondent && !q.isNotApplicable && !q.hasWaiver;
}


/** Motivo pelo qual um critério bloqueia o envio. */
type SubmissionBlock = {
  questionId: string;
  reason:
    | "unanswered"
    | "unresolved_evidence_adjustment";
};

export type SubmissionReadinessOptions = {
  /** No reenvio, toda solicitação de ajuste precisa ter sido substituída. */
  requireResolvedAdjustments?: boolean;
};

export type SubmissionReadiness = {
  ready: boolean;
  blocks: SubmissionBlock[];
};

export type SubmissionProgress = SubmissionReadiness & {
  totalEligible: number;
  answeredEligible: number;
};

/**
 * Avalia se o ciclo está pronto para `in_response → submitted` (6.4 linha 261):
 * todo critério ELEGÍVEL precisa estar respondido. A ausência de evidência
 * obrigatória não é incompletude de envio: sem aprovação o obtido permanece 0
 * (peso possível 2,0 na v7) e gera recomendação oficial quando cabível.
 *
 * Critérios não-elegíveis (não-aplicável, waiver, não-respondente) nunca
 * bloqueiam. Função pura: a rota só traduz o resultado em HTTP.
 */
export function evaluateSubmissionReadiness(
  questions: SubmissionQuestion[],
  options: SubmissionReadinessOptions = {},
): SubmissionReadiness {
  const blocks: SubmissionBlock[] = [];

  for (const q of questions) {
    if (!isEligibleForRecommendation(q)) continue;

    // Precisa estar respondido.
    if (q.answer === null || q.answer === undefined) {
      blocks.push({ questionId: q.questionId, reason: "unanswered" });
      continue;
    }

    if (options.requireResolvedAdjustments) {
      const unresolved =
        typeof q.unresolvedAdjustmentRequestCount === "number"
          ? q.unresolvedAdjustmentRequestCount
          : q.validationStatus === "adjustment_requested" &&
              !q.hasResolvedAllAdjustments
            ? 1
            : q.proofRequested
              ? 1
              : 0;
      if (unresolved > 0) {
        blocks.push({
          questionId: q.questionId,
          reason: "unresolved_evidence_adjustment",
        });
      }
    }
  }

  return { ready: blocks.length === 0, blocks };
}

/**
 * Resumo único de progresso e prontidão para telas e dashboards.
 *
 * O denominador considera somente critérios elegíveis, exatamente como o
 * envio oficial. A resposta conta como preenchida mesmo sem evidência; a
 * conformidade documental é refletida depois no FAMI e nas recomendações.
 */
export function evaluateSubmissionProgress(
  questions: SubmissionQuestion[],
  options: SubmissionReadinessOptions = {},
): SubmissionProgress {
  const eligible = questions.filter(isEligibleForRecommendation);
  const answeredEligible = eligible.filter(
    (question) => question.answer !== null && question.answer !== undefined,
  ).length;
  const readiness = evaluateSubmissionReadiness(questions, options);

  return {
    ...readiness,
    totalEligible: eligible.length,
    answeredEligible,
  };
}
