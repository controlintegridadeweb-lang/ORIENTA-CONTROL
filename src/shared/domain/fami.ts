import type { AnswerValue, FamiLevel, QuestionInput } from "./types";
import {
  CURRENT_FAMI_POLICY,
  FamiPolicy,
  levelForPercentage,
  weightForQuestion,
} from "./fami-policy";

type FamiScopeResult = {
  pointsObtained: number;
  pointsPossible: number;
  percentage: number;
  maturityLevel: FamiLevel;
};

export type FamiSummary = {
  policyVersion: string;
  bySection: Record<string, FamiScopeResult>;
  byAxis: Record<string, FamiScopeResult>;
  global: FamiScopeResult;
};

export type FamiCriterionScoreInput = {
  answer: AnswerValue | null | undefined;
  requiresEvidence: boolean;
  hasApprovedEvidence: boolean;
  /**
   * Decisão administrativa ou documental de insuficiência.
   * Em política v5+ zera o obtido; não se confunde com “Não se aplica”.
   */
  isInsufficient?: boolean;
  /** Quando false, o critério fica fora do numerador e do denominador. */
  includedInCalculation?: boolean;
};

export type FamiCriterionScore = {
  obtainedPoints: number;
  possiblePoints: number;
  includedInCalculation: boolean;
};

export type FamiCriterionScoreReason =
  | "yes_without_evidence_requirement"
  | "approved_evidence"
  | "evidence_not_approved"
  | "insufficient"
  | "negative_answer"
  | "not_applicable"
  | "unanswered";

export type CriterionScoreResult = FamiCriterionScore & {
  reason: FamiCriterionScoreReason;
  isOfficial: boolean;
};

/** Elegível para recomendação: applies ∧ ¬N/A ∧ ¬waiver */
export function isEligibleForRecommendation(question: QuestionInput): boolean {
  if (question.appliesToRespondent === false) return false;
  // isNotApplicable deve refletir N/A aprovado (coletores / isEffectiveNotApplicable).
  if (question.isNotApplicable) return false;
  if (question.waived) return false;
  return true;
}

/** Elegível para entrar no denominador do FAMI: aplicável ∧ FAMI habilitado. */
export function isEligibleForFami(question: QuestionInput): boolean {
  return isEligibleForRecommendation(question) && question.famiEnabled;
}

/**
 * Fonte única da pontuação unitária FAMI (política vigente em `fami-policy`).
 *
 * - Não se aplica / excluído → fora do cálculo (`includedInCalculation=false`);
 * - Não → 0 obtido;
 * - Sim sem exigência de evidência → 1,0 / 1,0;
 * - Sim com evidência aprovada → 2,0 / 2,0 (v7);
 * - Sim que exige evidência sem aprovação → 0 / 2,0 (v7; sem provisório).
 */
export function scoreFamiCriterion(
  input: FamiCriterionScoreInput,
  policy: FamiPolicy = CURRENT_FAMI_POLICY,
): FamiCriterionScore {
  const included =
    input.includedInCalculation !== false && input.answer !== "not_applicable";

  if (!included) {
    return {
      obtainedPoints: 0,
      possiblePoints: 0,
      includedInCalculation: false,
    };
  }

  const possiblePoints = weightForQuestion(input.requiresEvidence, policy);

  if (input.answer !== "yes") {
    return {
      obtainedPoints: 0,
      possiblePoints,
      includedInCalculation: true,
    };
  }

  if (!input.requiresEvidence) {
    return {
      obtainedPoints: policy.yesWithoutEvidenceWeight,
      possiblePoints,
      includedInCalculation: true,
    };
  }

  if (input.hasApprovedEvidence) {
    return {
      obtainedPoints: policy.yesWithApprovedEvidenceWeight,
      possiblePoints,
      includedInCalculation: true,
    };
  }

  // Pendente, ausente, insuficiente ou validado sem comprovação:
  // usa o peso sem aprovação da política (0 na v7; 1 em v5/v6 histórico).
  if (input.isInsufficient && policy.insufficientObtainsZero) {
    return {
      obtainedPoints: 0,
      possiblePoints,
      includedInCalculation: true,
    };
  }

  return {
    obtainedPoints: policy.yesWithUnapprovedEvidenceWeight,
    possiblePoints,
    includedInCalculation: true,
  };
}

/** Motivo legível da pontuação — não recalcula; só classifica a ramificação. */
export function reasonForFamiCriterion(
  input: FamiCriterionScoreInput,
  policy: FamiPolicy = CURRENT_FAMI_POLICY,
): FamiCriterionScoreReason {
  if (
    input.includedInCalculation === false ||
    input.answer === "not_applicable"
  ) {
    return "not_applicable";
  }
  if (input.answer == null) return "unanswered";
  if (input.answer !== "yes") return "negative_answer";
  if (!input.requiresEvidence) return "yes_without_evidence_requirement";
  if (input.hasApprovedEvidence) return "approved_evidence";
  if (input.isInsufficient && policy.insufficientObtainsZero) {
    return "insufficient";
  }
  return "evidence_not_approved";
}

/**
 * Resultado de apresentação da pontuação unitária.
 * Pontos vêm exclusivamente de `scoreFamiCriterion`.
 */
export function calculateFamiCriterion(
  input: FamiCriterionScoreInput & { isOfficial?: boolean },
  policy: FamiPolicy = CURRENT_FAMI_POLICY,
): CriterionScoreResult {
  const score = scoreFamiCriterion(input, policy);
  return {
    ...score,
    reason: reasonForFamiCriterion(input, policy),
    isOfficial: Boolean(input.isOfficial) && score.includedInCalculation,
  };
}

function hasApprovedEvidence(question: QuestionInput): boolean {
  return question.validationStatus === "approved";
}

function isInsufficientCriterion(question: QuestionInput): boolean {
  if (question.adminProofStatus === "considered_insufficient") return true;
  return question.validationStatus === "invalidated";
}

function obtainedPoints(question: QuestionInput, policy: FamiPolicy): number {
  if (!isEligibleForFami(question)) return 0;
  return scoreFamiCriterion(
    {
      answer: question.answer,
      requiresEvidence: question.requiresEvidence,
      hasApprovedEvidence: hasApprovedEvidence(question),
      isInsufficient: isInsufficientCriterion(question),
      includedInCalculation: true,
    },
    policy,
  ).obtainedPoints;
}

function calculateScope(
  questions: QuestionInput[],
  policy: FamiPolicy,
): FamiScopeResult {
  const scoped = questions.filter(isEligibleForFami);
  const pointsPossible = scoped.reduce(
    (sum, q) => sum + weightForQuestion(q.requiresEvidence, policy),
    0,
  );

  if (pointsPossible === 0) {
    return {
      pointsObtained: 0,
      pointsPossible: 0,
      percentage: 0,
      maturityLevel: "N/A",
    };
  }

  const pointsObtained = scoped.reduce(
    (sum, q) => sum + obtainedPoints(q, policy),
    0,
  );
  const normalizedPercentage = Number(
    ((pointsObtained / pointsPossible) * 100).toFixed(2),
  );

  return {
    pointsObtained: Number(pointsObtained.toFixed(2)),
    pointsPossible: Number(pointsPossible.toFixed(2)),
    percentage: normalizedPercentage,
    maturityLevel: levelForPercentage(normalizedPercentage, policy),
  };
}

function aggregateGlobal(
  axisResults: FamiScopeResult[],
  policy: FamiPolicy,
): FamiScopeResult {
  const applicable = axisResults.filter((r) => r.maturityLevel !== "N/A");
  if (applicable.length === 0) {
    return {
      pointsObtained: 0,
      pointsPossible: 0,
      percentage: 0,
      maturityLevel: "N/A",
    };
  }

  const pointsPossible = applicable.reduce((s, r) => s + r.pointsPossible, 0);
  const pointsObtained = applicable.reduce((s, r) => s + r.pointsObtained, 0);
  const normalizedPercentage = Number(
    (pointsPossible > 0 ? (pointsObtained / pointsPossible) * 100 : 0).toFixed(2),
  );

  return {
    pointsObtained: Number(pointsObtained.toFixed(2)),
    pointsPossible: Number(pointsPossible.toFixed(2)),
    percentage: normalizedPercentage,
    maturityLevel: levelForPercentage(normalizedPercentage, policy),
  };
}

export function calculateFami(
  questions: QuestionInput[],
  policy: FamiPolicy = CURRENT_FAMI_POLICY,
): FamiSummary {
  const sectionIds = [...new Set(questions.map((q) => q.sectionId))];
  const axisIds = [...new Set(questions.map((q) => q.axisId))];

  const bySection = Object.fromEntries(
    sectionIds.map((sectionId) => [
      sectionId,
      calculateScope(
        questions.filter((q) => q.sectionId === sectionId),
        policy,
      ),
    ]),
  );

  const byAxis = Object.fromEntries(
    axisIds.map((axisId) => [
      axisId,
      calculateScope(
        questions.filter((q) => q.axisId === axisId),
        policy,
      ),
    ]),
  );

  return {
    policyVersion: policy.version,
    bySection,
    byAxis,
    global: aggregateGlobal(Object.values(byAxis), policy),
  };
}
