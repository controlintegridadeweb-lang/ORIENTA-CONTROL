import type { EvidenceVerdict, NaQueueStatus } from "./queue-types";

/** Situação do critério (cabeçalho do card). */
export const VERDICT_LABEL: Record<EvidenceVerdict, string> = {
  pending: "Aguardando validação",
  approved: "Aprovada",
  invalidated: "Insuficiente",
  considered_insufficient: "Insuficiente",
  adjustment_requested: "Ajuste solicitado",
  not_presented: "Aguardando comprovação",
  validated_without_proof: "Resposta validada sem comprovação",
  proof_requested: "Comprovação solicitada",
};

/** Situação da evidência individual — distinta da situação do critério. */
export const DOCUMENT_STATUS_LABEL: Record<
  Extract<
    EvidenceVerdict,
    "pending" | "approved" | "invalidated" | "adjustment_requested"
  >,
  string
> = {
  pending: "Aguardando análise",
  approved: "Aprovado",
  invalidated: "Insuficiente",
  adjustment_requested: "Ajuste solicitado",
};

export const NA_VERDICT_LABEL: Record<NaQueueStatus, string> = {
  pending: "Aguardando decisão",
  approved: "Aceito",
  rejected: "Rejeitado",
};

export const EVIDENCE_JUSTIFICATION_PRESETS = [
  "Evidência não apresentada",
  "Evidência insuficiente",
] as const;

export function answerLabel(answer: "yes" | "no"): string {
  return answer === "yes" ? "Sim" : "Não";
}

export function justificationRequired(
  action: "approve" | "invalidate" | "request_adjustment",
): boolean {
  return action !== "approve";
}

export function canSubmitVerdict(
  action: "approve" | "invalidate" | "request_adjustment",
  justification: string,
): boolean {
  return !justificationRequired(action) || justification.trim().length > 0;
}

export function canSubmitNaVerdict(
  action: "approve" | "reject",
  rejectionReason: string,
): boolean {
  return action === "approve" || rejectionReason.trim().length > 0;
}
