import {
  summarizeEvidenceAdjustmentResolution,
  type EvidenceAdjustmentRecord,
  type EvidenceAdjustmentResolution,
} from "./evidence-adjustment-matching";

export type RespondentCorrectionInput = {
  evidences: readonly EvidenceAdjustmentRecord[];
  /** Resposta marcada pela administração para enviar comprovação. */
  proofRequested: boolean;
  /**
   * Há evidência `pending` ativa. No SQL de reenvio, isso resolve a
   * solicitação de comprovação ausente.
   */
  hasPendingEvidence: boolean;
};

/**
 * Une devolutiva documental (`adjustment_requested`) e comprovação ausente
 * (`proof_requested`) na mesma contagem de pendências do respondente.
 */
export function summarizeRespondentCorrectionResolution(
  input: RespondentCorrectionInput,
): EvidenceAdjustmentResolution {
  const evidence = summarizeEvidenceAdjustmentResolution(input.evidences);
  if (!input.proofRequested) return evidence;

  const proofResolved = input.hasPendingEvidence;
  const requestedCount = evidence.requestedCount + 1;
  const resolvedCount = evidence.resolvedCount + (proofResolved ? 1 : 0);
  const unresolvedCount = evidence.unresolvedCount + (proofResolved ? 0 : 1);

  return {
    requestedCount,
    resolvedCount,
    unresolvedCount,
    hasAdjustmentRequest: true,
    hasResolvedAllAdjustments: unresolvedCount === 0,
  };
}
