import type { EvidenceDraft } from "@/features/workbench/evidence-draft";
import { hasEvidenceCandidate } from "@/features/workbench/evidence-candidate";
import type { WorkbenchRow } from "@/features/workbench/load-workbench-payload";
import { hasEvidenceContent } from "@/shared/domain/evidence-presence";
import {
  EVIDENCE_PENDING_UPLOAD_MESSAGE,
  validateYesWithEvidence,
  type YesEvidenceFieldErrors,
} from "@/features/workbench/validate-yes-evidence";

/** Arquivo novo no rascunho ainda precisa do token de upload pendente. */
function isNewFileDraftMissingUploadToken(
  row: WorkbenchRow,
  draft: EvidenceDraft,
): boolean {
  if (!draft.storagePath?.trim()) return false;
  if (draft.kind !== "file" && draft.kind !== null) return false;
  return !draft.pendingUploadId && !row.evidenceId;
}

/**
 * Valida somente anexos efetivamente iniciados. A ausência total de evidência
 * é uma não conformidade diagnóstica válida: não bloqueia a resposta "Sim".
 */
export function validateYesEvidenceDraftForRow(
  row: WorkbenchRow,
  draft: EvidenceDraft,
): YesEvidenceFieldErrors {
  if (!row.requiresEvidence || !hasEvidenceCandidate(row, draft)) return {};

  const attachments = draft.attachments ?? [];
  if (attachments.length > 0) {
    const errors: YesEvidenceFieldErrors = {};
    if (
      attachments.some((item) => {
        if (item.kind === "file") {
          return !item.storagePath || !item.pendingUploadId;
        }
        if (item.kind === "text") {
          return !item.textBody?.trim();
        }
        return !item.externalLink?.trim();
      })
    ) {
      errors.attachment = EVIDENCE_PENDING_UPLOAD_MESSAGE;
    }
    if (attachments.some((item) => !item.title.trim())) {
      errors.title = "Informe o título de cada evidência.";
    }
    if (draft.kind === "link") {
      if (!draft.externalLink.trim()) {
        errors.attachment = "Informe a URL da evidência.";
      }
      if (!draft.title.trim()) {
        errors.title = "Informe o título de cada evidência.";
      }
    }
    if (draft.kind === "text") {
      if (!draft.textBody.trim()) {
        errors.attachment = "Informe o texto da comprovação.";
      }
      if (!draft.title.trim()) {
        errors.title = "Informe o título de cada evidência.";
      }
    }
    return errors;
  }

  const persistedEvidence = row.evidences?.find((item) =>
    hasEvidenceContent({
      kind: item.kind,
      storagePath: item.storagePath,
      externalLink: item.externalLink,
      textBody: item.textBody,
    }),
  );
  const errors = validateYesWithEvidence(
    {
      kind: draft.kind,
      title: draft.title,
      storagePath: draft.storagePath,
      externalLink: draft.externalLink,
      textBody: draft.textBody,
    },
    {
      kind:
        persistedEvidence?.kind ??
        (row.storagePath
          ? "file"
          : row.externalLink
            ? "link"
            : row.textBody
              ? "text"
              : null),
      title: persistedEvidence?.title ?? row.evidenceTitle,
      storagePath: persistedEvidence?.storagePath ?? row.storagePath,
      externalLink: persistedEvidence?.externalLink ?? row.externalLink,
      textBody: persistedEvidence?.textBody ?? row.textBody,
    },
  ).errors;

  if (!errors.attachment && isNewFileDraftMissingUploadToken(row, draft)) {
    errors.attachment = EVIDENCE_PENDING_UPLOAD_MESSAGE;
  }
  return errors;
}

export function canSaveYesEvidenceDraft(
  row: WorkbenchRow,
  draft: EvidenceDraft,
): boolean {
  return Object.keys(validateYesEvidenceDraftForRow(row, draft)).length === 0;
}
