/**
 * Política FAMI — constante de domínio única e versionada.
 * Congelada por `cycle_processings` na conclusão da validação do diagnóstico.
 *
 * Regra oficial v7 (evidence_weighted):
 * - Sim em critério que NÃO exige evidência: 1,0 obtido / 1,0 possível;
 * - Sim em critério que exige evidência, com comprovação aprovada: 2,0 / 2,0;
 * - Sim que exige evidência sem aprovação (pendente, ausente, insuficiente,
 *   validado sem comprovação): 0 / 2,0 — sem pontuação provisória;
 * - Não: 0 / (1,0 ou 2,0 conforme a exigência);
 * - Não se aplica / não aplicável à organização: excluído do cálculo.
 *
 * Histórico imutável:
 * - v3/v4/v5: peso aprovado 1,5;
 * - v5/v6: baseline 1,0 quando exige evidência sem aprovação;
 * - novas finalizações congelam v7 (peso aprovado 2,0; sem baseline).
 */

/** Pesos oficiais da política vigente — única fonte para novos cálculos. */
export const FAMI_WEIGHTS = {
  WITHOUT_REQUIRED_EVIDENCE: 1,
  WITH_REQUIRED_EVIDENCE_APPROVED: 2,
  /** Em v7+ não há ponto provisório: sem aprovação = 0. */
  WITH_REQUIRED_EVIDENCE_WITHOUT_APPROVAL: 0,
  ADMINISTRATIVELY_INSUFFICIENT: 0,
} as const;

/** Peso máximo com evidência aprovada nas políticas históricas v3–v5. */
export const FAMI_LEGACY_APPROVED_EVIDENCE_WEIGHT = 1.5;

/** Baseline histórico (v5/v6) para Sim que exige evidência sem aprovação. */
export const FAMI_LEGACY_UNAPPROVED_EVIDENCE_BASELINE = 1;

export type FamiThreshold = {
  level: 1 | 2 | 3 | 4 | 5;
  maxPercentage: number;
};

export type EvidenceWeightedFamiPolicy = {
  version: string;
  scoringModel: "evidence_weighted";
  /** Peso do critério que não exige evidência (obtido e possível). */
  yesWithoutEvidenceWeight: number;
  /** Peso do critério que exige evidência (possível; obtido só com aprovação). */
  yesWithApprovedEvidenceWeight: number;
  /**
   * Obtido quando exige evidência, resposta Sim e ainda não há aprovação.
   * v7+ = 0; v5/v6 histórico = 1.
   */
  yesWithUnapprovedEvidenceWeight: number;
  /**
   * Quando true (v5+), decisão de insuficiência zera o obtido.
   * Em v3/v4 a insuficiência documental mantinha o baseline 1,0.
   */
  insufficientObtainsZero: boolean;
  thresholds: FamiThreshold[];
};

export type FamiPolicy = EvidenceWeightedFamiPolicy;

export const CURRENT_FAMI_POLICY: EvidenceWeightedFamiPolicy = {
  version: "v7",
  scoringModel: "evidence_weighted",
  yesWithoutEvidenceWeight: FAMI_WEIGHTS.WITHOUT_REQUIRED_EVIDENCE,
  yesWithApprovedEvidenceWeight: FAMI_WEIGHTS.WITH_REQUIRED_EVIDENCE_APPROVED,
  yesWithUnapprovedEvidenceWeight:
    FAMI_WEIGHTS.WITH_REQUIRED_EVIDENCE_WITHOUT_APPROVAL,
  insufficientObtainsZero: true,
  thresholds: [
    { level: 1, maxPercentage: 20 },
    { level: 2, maxPercentage: 40 },
    { level: 3, maxPercentage: 60 },
    { level: 4, maxPercentage: 80 },
    { level: 5, maxPercentage: 100 },
  ],
};

/** Versões de política reconhecidas no congelamento histórico. */
export const SUPPORTED_FAMI_POLICY_VERSIONS = [
  "v3",
  "v4",
  "v5",
  "v6",
  "v7",
] as const;

export type SupportedFamiPolicyVersion =
  (typeof SUPPORTED_FAMI_POLICY_VERSIONS)[number];

function policyVersionNumber(version: string): number {
  const match = /^v(\d+)$/.exec(version);
  return match ? Number(match[1]) : Number.NaN;
}

/**
 * Reconstrói a política congelada de um processamento.
 * Usada na conferência e na apresentação de resultados históricos —
 * não sobrescreve pesos antigos com a regra vigente.
 */
export function famiPolicyFromFrozenWeights(input: {
  version: string;
  yesWithoutEvidenceWeight: number;
  yesWithApprovedEvidenceWeight: number;
  thresholds: FamiThreshold[];
}): FamiPolicy {
  const versionNum = policyVersionNumber(input.version);
  const insufficientObtainsZero = versionNum >= 5;
  // Baseline 1,0 só existiu em v5/v6; v3/v4 e v7+ usam 0 sem aprovação.
  const yesWithUnapprovedEvidenceWeight =
    input.version === "v5" || input.version === "v6"
      ? FAMI_LEGACY_UNAPPROVED_EVIDENCE_BASELINE
      : 0;

  return {
    version: input.version,
    scoringModel: "evidence_weighted",
    yesWithoutEvidenceWeight: input.yesWithoutEvidenceWeight,
    yesWithApprovedEvidenceWeight: input.yesWithApprovedEvidenceWeight,
    yesWithUnapprovedEvidenceWeight,
    insufficientObtainsZero,
    thresholds: input.thresholds,
  };
}

export function weightForQuestion(
  requiresEvidence: boolean,
  policy: FamiPolicy = CURRENT_FAMI_POLICY,
): number {
  return requiresEvidence
    ? policy.yesWithApprovedEvidenceWeight
    : policy.yesWithoutEvidenceWeight;
}

export function levelForPercentage(
  percentage: number,
  policy: FamiPolicy = CURRENT_FAMI_POLICY,
): 1 | 2 | 3 | 4 | 5 {
  for (const threshold of policy.thresholds) {
    if (percentage <= threshold.maxPercentage) {
      return threshold.level;
    }
  }
  return 5;
}

/** Formata pontos FAMI para exibição (pt-BR). */
export function formatFamiPoints(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  });
}
