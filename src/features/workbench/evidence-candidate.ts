import { hasEvidenceContent } from "@/shared/domain/evidence-presence";
import type { EvidenceDraft } from "@/features/workbench/evidence-draft";
import type { WorkbenchRow } from "@/features/workbench/load-workbench-payload";

/** Indica se há evidência persistida ou algum rascunho de comprovação iniciado. */
export function hasEvidenceCandidate(
  row: WorkbenchRow,
  draft: EvidenceDraft,
): boolean {
  if (
    (row.evidences ?? []).some((item) =>
      hasEvidenceContent({
        kind: item.kind,
        storagePath: item.storagePath,
        externalLink: item.externalLink,
        textBody: item.textBody,
      }),
    )
  ) {
    return true;
  }
  if (row.evidenceId || row.storagePath || row.externalLink || row.textBody) {
    return true;
  }
  if ((draft.attachments ?? []).length > 0) return true;
  return Boolean(
    draft.storagePath ||
      draft.externalLink.trim() ||
      draft.textBody.trim() ||
      draft.title.trim() ||
      draft.description.trim(),
  );
}
