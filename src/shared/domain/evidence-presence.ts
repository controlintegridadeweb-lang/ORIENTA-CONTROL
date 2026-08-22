/**
 * Presença de comprovação por modalidade.
 * Fonte de verdade: registros em evidences — nunca responses.notes.
 */

export type EvidencePresenceKind = "file" | "link" | "text";

export type EvidencePresenceFields = {
  kind?: EvidencePresenceKind | string | null;
  storagePath?: string | null;
  externalLink?: string | null;
  textBody?: string | null;
  title?: string | null;
};

export function hasFileEvidence(item: EvidencePresenceFields): boolean {
  if (item.kind != null && item.kind !== "file") return false;
  return Boolean(item.storagePath?.trim());
}

export function hasLinkEvidence(item: EvidencePresenceFields): boolean {
  if (item.kind != null && item.kind !== "link") return false;
  return Boolean(item.externalLink?.trim());
}

export function hasTextEvidence(item: EvidencePresenceFields): boolean {
  if (item.kind != null && item.kind !== "text") return false;
  return Boolean(item.textBody?.trim());
}

/** Há comprovação utilizável em qualquer modalidade. */
export function hasEvidenceContent(item: EvidencePresenceFields): boolean {
  if (item.kind === "file") return hasFileEvidence(item);
  if (item.kind === "link") return hasLinkEvidence(item);
  if (item.kind === "text") return hasTextEvidence(item);
  return (
    hasFileEvidence({ ...item, kind: "file" }) ||
    hasLinkEvidence({ ...item, kind: "link" }) ||
    hasTextEvidence({ ...item, kind: "text" })
  );
}

export function hasAnyEvidenceContent(
  items: readonly EvidencePresenceFields[],
): boolean {
  return items.some(hasEvidenceContent);
}
