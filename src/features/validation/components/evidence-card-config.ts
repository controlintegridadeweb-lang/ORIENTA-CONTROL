import type { QueueEvidence, QueueEvidenceGroup } from "../queue-model";
import type {
  AbsentProofDecisionAction,
  EvidenceDecisionAction,
} from "../contracts";
import { formSurface } from "@/shared/layout/form-surface";

export const EVIDENCE_ACTION_LABEL: Record<EvidenceDecisionAction, string> = {
  approve: "Aprovar evidência",
  invalidate: "Considerar insuficiente",
  request_adjustment: "Solicitar ajuste",
};

export const EVIDENCE_ACTION_SUCCESS: Record<EvidenceDecisionAction, string> = {
  approve: "Evidência aprovada.",
  invalidate: "Critério marcado como insuficiente (0 ponto).",
  request_adjustment:
    "Ajuste solicitado. Envie a devolutiva quando concluir a análise.",
};

export const EVIDENCE_STATUS_BADGE: Record<QueueEvidence["status"], string> = {
  pending: formSurface.badge.warning,
  approved: formSurface.badge.success,
  invalidated: formSurface.badge.danger,
  considered_insufficient: formSurface.badge.danger,
  adjustment_requested: formSurface.badge.info,
  not_presented: formSurface.badge.warning,
  validated_without_proof: formSurface.badge.success,
  proof_requested: formSurface.badge.info,
};

/** Decisões administrativas do critério (sem documento) — distintas das ações da evidência. */
export const ABSENT_ACTION_LABEL: Record<AbsentProofDecisionAction, string> = {
  validate_without_proof: "Validar sem comprovação",
  consider_insufficient: "Considerar o critério insuficiente",
  request_proof: "Solicitar comprovação",
};

export function formatValidationDateTime(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function absentDecisionMeta(group: QueueEvidenceGroup): string | null {
  const parts = [
    group.adminProofDecidedByName
      ? `Responsável: ${group.adminProofDecidedByName}`
      : null,
    formatValidationDateTime(group.adminProofDecidedAt),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function evidenceChoiceButtonClass(active: boolean): string {
  return active
    ? `${formSurface.secondaryButtonSm} border-brand-400 bg-brand-50 text-brand-900`
    : formSurface.secondaryButtonSm;
}

/** Botão de decisão sobre evidência com peso visual distinto. */
export function evidenceDecisionButtonClass(
  action: EvidenceDecisionAction,
  active: boolean,
): string {
  return administrativeDecisionButtonClass(action, active);
}

/**
 * Peso visual unificado das decisões (evidência e administrativas).
 * Ação principal sólida; demais secundárias.
 */
export function administrativeDecisionButtonClass(
  action: EvidenceDecisionAction | AbsentProofDecisionAction,
  active: boolean,
): string {
  const isPrimary =
    action === "approve" || action === "validate_without_proof";
  if (isPrimary) {
    return active
      ? `${formSurface.primaryButtonSm} ring-2 ring-brand-300 ring-offset-1 w-full sm:w-auto`
      : `${formSurface.primaryButtonSm} w-full sm:w-auto`;
  }
  return active
    ? `${formSurface.secondaryButtonSm} border-brand-400 bg-brand-50 text-brand-900 w-full sm:w-auto`
    : `${formSurface.secondaryButtonSm} w-full sm:w-auto`;
}

/** Nome amigável para link externo; URL completa fica em title/tooltip. */
export function friendlyEvidenceLinkLabel(url: string | null | undefined): string {
  if (!url?.trim()) return "Link externo";
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    if (host.includes("drive.google") || host.includes("docs.google")) {
      return "Google Drive";
    }
    if (host.includes("dropbox")) return "Dropbox";
    if (host.includes("onedrive") || host.includes("sharepoint")) {
      return "OneDrive";
    }
    if (host.includes("github")) return "GitHub";
    return host || "Link externo";
  } catch {
    return "Link externo";
  }
}
