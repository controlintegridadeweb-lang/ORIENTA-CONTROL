import type { ActionPlanDocument } from "@/features/improvement-management/action-plans/domain-model";

/**
 * Mantém na aplicação a mesma leitura usada pelo banco ao liberar o aceite:
 * link HTTPS ativo na revisão atual ou arquivo estruturalmente válido.
 */
export function isValidExecutionEvidence(document: ActionPlanDocument): boolean {
  if (!document.isCurrentRevision) return false;
  if (document.fileValidationStatus === "removed") return false;
  if (document.kind === "link") return Boolean(document.externalLink?.trim());
  return document.fileValidationStatus === "valid";
}

export function hasValidExecutionEvidence(documents: ActionPlanDocument[]): boolean {
  return documents.some(isValidExecutionEvidence);
}
