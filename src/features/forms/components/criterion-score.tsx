"use client";

import {
  calculateFamiCriterion,
  type FamiCriterionScoreReason,
} from "@/shared/domain/fami";
import {
  CURRENT_FAMI_POLICY,
  formatFamiPoints,
} from "@/shared/domain/fami-policy";
import type { AnswerValue } from "@/shared/domain/types";
import { isOfficialFamiEligible } from "@/shared/domain/workflow";
import { formSurface } from "@/shared/layout/form-surface";

export type CriterionEvidenceStatus =
  | "approved"
  | "pending"
  | "insufficient"
  | "rejected"
  | "not_submitted"
  | "validated_without_proof"
  | null
  | undefined;

export type CriterionScoreProps = {
  answer: AnswerValue | null | undefined;
  requiresEvidence: boolean;
  evidenceStatus?: CriterionEvidenceStatus;
  /** Quando false, o critério não compõe o FAMI (não renderiza). */
  famiEnabled?: boolean;
  /** Ex.: waiver administrativo ou N/A efetivo já refletido em `answer`. */
  includedInCalculation?: boolean;
  diagnosisStatus?: string | null;
  /** Quando informado, reforça se o processamento FAMI já está concluído. */
  famiProcessingStatus?: "working" | "completed" | null;
  className?: string;
};

const badgeClass = `${formSurface.badge.base} ${formSurface.badge.neutral}`;

function reasonDetail(
  reason: FamiCriterionScoreReason,
  evidenceStatus: CriterionEvidenceStatus,
  obtained: number,
  possible: number,
): string {
  const obtainedLabel = formatFamiPoints(obtained);
  const possibleLabel = formatFamiPoints(possible);

  if (reason === "approved_evidence") {
    return `Evidência aprovada. Pontuação · ${obtainedLabel} de ${possibleLabel}.`;
  }
  if (reason === "insufficient") {
    return `Considerado insuficiente pela análise administrativa. Pontuação · ${obtainedLabel} de ${possibleLabel}.`;
  }
  if (reason === "evidence_not_approved") {
    if (evidenceStatus === "validated_without_proof") {
      return `Validado sem comprovação. Pontuação · ${obtainedLabel} de ${possibleLabel}.`;
    }
    if (evidenceStatus === "not_submitted") {
      return `Resposta positiva sem comprovação. Pontuação · ${obtainedLabel} de ${possibleLabel}.`;
    }
    return `Evidência aguardando validação. Pontuação · ${obtainedLabel} de ${possibleLabel}.`;
  }
  if (reason === "yes_without_evidence_requirement") {
    return `Resposta "Sim". Pontuação · ${obtainedLabel} de ${possibleLabel}.`;
  }
  if (reason === "negative_answer") {
    return `Resposta "Não". Pontuação · ${obtainedLabel} de ${possibleLabel}.`;
  }
  if (reason === "not_applicable") {
    return 'Resposta "Não se aplica" — fora do cálculo.';
  }
  return "Sem resposta";
}

function resolveIsOfficial(
  diagnosisStatus: string | null | undefined,
  famiProcessingStatus: CriterionScoreProps["famiProcessingStatus"],
): boolean {
  if (!isOfficialFamiEligible(diagnosisStatus)) return false;
  if (famiProcessingStatus === "working") return false;
  return true;
}

/**
 * Selo único e discreto da pontuação FAMI do critério.
 * Consome apenas `calculateFamiCriterion` — sem regra própria.
 */
export function CriterionScore({
  answer,
  requiresEvidence,
  evidenceStatus = null,
  famiEnabled = true,
  includedInCalculation = true,
  diagnosisStatus = null,
  famiProcessingStatus = null,
  className = "",
}: CriterionScoreProps) {
  if (!famiEnabled) return null;

  const hasApprovedEvidence = evidenceStatus === "approved";
  const isInsufficient =
    evidenceStatus === "insufficient" || evidenceStatus === "rejected";
  const isOfficial = resolveIsOfficial(diagnosisStatus, famiProcessingStatus);
  const score = calculateFamiCriterion({
    answer,
    requiresEvidence,
    hasApprovedEvidence,
    isInsufficient,
    includedInCalculation,
    isOfficial,
  });

  const detail = reasonDetail(
    score.reason,
    evidenceStatus,
    score.obtainedPoints,
    score.possiblePoints ||
      (requiresEvidence
        ? CURRENT_FAMI_POLICY.yesWithApprovedEvidenceWeight
        : CURRENT_FAMI_POLICY.yesWithoutEvidenceWeight),
  );

  if (!score.includedInCalculation) {
    return (
      <span
        className={`${badgeClass} ${className}`.trim()}
        data-criterion-score="excluded"
        title={detail}
      >
        FAMI · fora do cálculo
      </span>
    );
  }

  if (score.reason === "unanswered") {
    return (
      <span
        className={`${badgeClass} ${className}`.trim()}
        data-criterion-score="unanswered"
        data-criterion-reason="unanswered"
        title="Peso máximo do critério no FAMI"
      >
        FAMI · peso {formatFamiPoints(score.possiblePoints)}
      </span>
    );
  }

  const scoreKind = isOfficial ? "oficial" : "estimada";
  const obtainedLabel = formatFamiPoints(score.obtainedPoints);
  const possibleLabel = formatFamiPoints(score.possiblePoints);
  // Sempre obtido/máximo: critérios com evidência nunca sugerem "vale 1".
  const badgeLabel = `Pontuação · ${obtainedLabel} de ${possibleLabel}`;

  return (
    <span
      className={`${badgeClass} ${className}`.trim()}
      data-criterion-score={isOfficial ? "official" : "provisional"}
      data-criterion-reason={score.reason}
      title={`Pontuação ${scoreKind} · ${detail}`}
    >
      {badgeLabel}
    </span>
  );
}
