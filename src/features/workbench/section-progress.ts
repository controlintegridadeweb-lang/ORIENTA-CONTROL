import type { EvidenceDraft } from "@/features/workbench/evidence-draft";
import type { WorkbenchRow } from "@/features/workbench/load-workbench-payload";

/** Rascunho derivado do estado persistido da pergunta (sem alterações locais). */
function evidenceDraftFromRow(row: WorkbenchRow): EvidenceDraft {
  const latest = row.evidences?.at(-1);
  const kind =
    latest?.kind ??
    (row.storagePath ? "file" : row.externalLink ? "link" : row.textBody ? "text" : null);
  return {
    kind,
    title: latest?.title ?? row.evidenceTitle ?? "",
    description: latest?.description ?? row.evidenceDescription ?? "",
    externalLink: latest?.externalLink ?? row.externalLink ?? "",
    storagePath: latest?.storagePath ?? row.storagePath ?? null,
    pendingUploadId: null,
    textBody: latest?.textBody ?? row.textBody ?? "",
  };
}

/** Rascunho efetivo: alterações locais têm prioridade sobre o servidor. */
export function resolveEvidenceDraft(
  row: WorkbenchRow,
  drafts: Record<string, EvidenceDraft>,
): EvidenceDraft {
  return drafts[row.questionId] ?? evidenceDraftFromRow(row);
}


export function sectionStorageKey(cycleId: string): string {
  return `orienta.cycle.section.${cycleId}`;
}
