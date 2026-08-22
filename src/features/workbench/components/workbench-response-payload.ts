import type { WorkbenchEvidencePayload } from "@/infrastructure/client/workbench-api";
import type { EvidenceDraft } from "@/features/workbench/evidence-draft";
import { canSaveYesEvidenceDraft } from "@/features/workbench/validate-evidence-draft";
import type { Row } from "./workbench-helpers";
import { MAX_EVIDENCES_PER_SAVE } from "@/features/workbench/evidence-limits";

/**
 * Converte o rascunho da interface no contrato de persistência da resposta.
 * `null` representa uma combinação incompleta que ainda não pode ser salva;
 * `undefined` preserva a evidência já persistida no servidor.
 */
export function buildWorkbenchEvidencePayload(
  row: Row,
  draft: EvidenceDraft,
  options: { hasLocalChanges?: boolean } = {},
): WorkbenchEvidencePayload | undefined | null {
  if (row.answer !== "yes" || !row.requiresEvidence) return undefined;

  // Uma evidência já persistida só deve voltar no payload quando o usuário
  // realmente editou o rascunho. Isso evita reenviar automaticamente o mesmo
  // link e apagar indevidamente um veredito de ajuste solicitado.
  if (row.evidenceId && !options.hasLocalChanges) return undefined;

  const storagePath = draft.storagePath;
  const title = draft.title.trim();
  const hasFileDraft =
    Boolean(storagePath) &&
    Boolean(title) &&
    (draft.kind === "file" || draft.kind === null);
  if (hasFileDraft && storagePath) {
    // Caminho de arquivo só é aceitável quando pertence a um upload pendente
    // deste respondente. Sem essa identidade, pode ser uma evidência já
    // persistida (não reenviar payload) ou um rascunho inválido (bloquear).
    if (draft.pendingUploadId) {
      return {
        kind: "file",
        title,
        description: draft.description || undefined,
        storagePath,
        pendingUploadId: draft.pendingUploadId,
      };
    }
    return row.evidenceId ? undefined : null;
  }

  if (
    draft.kind === "link" &&
    draft.externalLink?.trim() &&
    draft.title.trim()
  ) {
    return {
      kind: "link",
      title: draft.title.trim(),
      description: draft.description || undefined,
      externalLink: draft.externalLink.trim(),
    };
  }

  if (draft.kind === "text" && draft.textBody.trim() && draft.title.trim()) {
    return {
      kind: "text",
      title: draft.title.trim(),
      description: draft.description || undefined,
      textBody: draft.textBody.trim(),
    };
  }

  return canSaveYesEvidenceDraft(row, draft) ? undefined : null;
}

/** Monta todos os novos anexos do critério sem reenviar evidências já salvas. */
export function buildWorkbenchEvidencePayloads(
  row: Row,
  draft: EvidenceDraft,
  options: { hasLocalChanges?: boolean } = {},
): WorkbenchEvidencePayload[] | undefined | null {
  const attachments = draft.attachments ?? [];
  if (attachments.length === 0) {
    const legacy = buildWorkbenchEvidencePayload(row, draft, options);
    return legacy === null ? null : legacy ? [legacy] : undefined;
  }

  const payloads: WorkbenchEvidencePayload[] = [];
  for (const attachment of attachments) {
    const title = attachment.title.trim();
    if (!title) return null;
    if (attachment.kind === "file") {
      if (!attachment.storagePath || !attachment.pendingUploadId) return null;
      payloads.push({
        kind: "file",
        title,
        description: attachment.description.trim() || undefined,
        storagePath: attachment.storagePath,
        pendingUploadId: attachment.pendingUploadId,
      });
      if (payloads.length > MAX_EVIDENCES_PER_SAVE) return null;
      continue;
    }
    if (attachment.kind === "text") {
      if (!attachment.textBody?.trim()) return null;
      payloads.push({
        kind: "text",
        title,
        description: attachment.description.trim() || undefined,
        textBody: attachment.textBody.trim(),
      });
      if (payloads.length > MAX_EVIDENCES_PER_SAVE) return null;
      continue;
    }
    if (!attachment.externalLink?.trim()) return null;
    payloads.push({
      kind: "link",
      title,
      description: attachment.description.trim() || undefined,
      externalLink: attachment.externalLink.trim(),
    });
    if (payloads.length > MAX_EVIDENCES_PER_SAVE) return null;
  }
  if (draft.kind === "link") {
    const title = draft.title.trim();
    const externalLink = draft.externalLink.trim();
    if (!title || !externalLink) return null;
    payloads.push({
      kind: "link",
      title,
      description: draft.description.trim() || undefined,
      externalLink,
    });
    if (payloads.length > MAX_EVIDENCES_PER_SAVE) return null;
  }
  if (draft.kind === "text") {
    const title = draft.title.trim();
    const textBody = draft.textBody.trim();
    if (!title || !textBody) return null;
    payloads.push({
      kind: "text",
      title,
      description: draft.description.trim() || undefined,
      textBody,
    });
    if (payloads.length > MAX_EVIDENCES_PER_SAVE) return null;
  }
  return payloads;
}
