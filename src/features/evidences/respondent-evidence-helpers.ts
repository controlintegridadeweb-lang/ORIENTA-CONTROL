import type { ValidationStatus } from "@/features/evidences/schemas";
import type { EvidenceListItem } from "./types";

export type { ValidationStatus };

export type RespondentOverallStatus =
  | "ok"
  | "pending_validation"
  | "action_required";

export type RespondentEvidenceNavigation = "edit" | "follow_up" | "correct" | null;

export function deriveValidationStatus(
  item: Pick<EvidenceListItem, "currentStatus" | "requiresEvidence">,
): ValidationStatus {
  const raw = item.currentStatus;
  if (raw) return raw;
  return item.requiresEvidence ? "pending" : "not_required";
}

/**
 * Só estados em que a organização pode agir entram como pendência.
 * Uma evidência não aprovada é uma decisão registrada na validação; ela não
 * reabre o diagnóstico e, portanto, não pode aparecer como correção possível.
 */
export function respondentStatusNeedsAction(status: ValidationStatus): boolean {
  return status === "pending" || status === "adjustment_requested";
}

/** Próxima navegação possível, sempre compatível com o estado do diagnóstico. */
export function respondentEvidenceNavigation(
  status: ValidationStatus,
): RespondentEvidenceNavigation {
  switch (status) {
    case "pending":
      return "edit";
    case "submitted":
      return "follow_up";
    case "adjustment_requested":
      return "correct";
    case "approved":
    case "invalidated":
    case "not_required":
      return null;
  }
}

/** Evidência não aprovada deve abrir a justificativa, sem prometer reenvio. */
export function respondentEvidenceDetailLabel(status: ValidationStatus): string {
  return status === "invalidated" ? "Ver justificativa" : "Ver detalhes";
}

export function overallStatus(counts: {
  pending: number;
  adjustment: number;
  submitted: number;
}): RespondentOverallStatus {
  if (counts.pending > 0 || counts.adjustment > 0) return "action_required";
  if (counts.submitted > 0) return "pending_validation";
  return "ok";
}
