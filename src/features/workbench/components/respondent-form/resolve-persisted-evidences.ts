import { hasEvidenceContent } from "@/shared/domain/evidence-presence";
import type {
  WorkbenchEvidence,
  WorkbenchRow,
} from "@/features/workbench/load-workbench-payload";

export type PersistedEvidenceRow = Pick<
  WorkbenchRow,
  | "evidenceId"
  | "evidenceTitle"
  | "evidenceDescription"
  | "externalLink"
  | "storagePath"
  | "textBody"
  | "validationStatus"
  | "validationJustification"
  | "evidences"
>;

/** Anexo utilizável: arquivo, link ou comprovação textual. */
export function hasUsableEvidenceAttachment(
  item: Pick<WorkbenchEvidence, "storagePath" | "externalLink" | "textBody"> & {
    kind?: WorkbenchEvidence["kind"] | null;
  },
): boolean {
  return hasEvidenceContent({
    kind: item.kind,
    storagePath: item.storagePath,
    externalLink: item.externalLink,
    textBody: item.textBody,
  });
}

/**
 * Monta o item legado a partir dos campos planos da linha.
 * Só retorna evidência quando há identificador e comprovação utilizável.
 */
export function buildLegacyPersistedEvidence(
  row: PersistedEvidenceRow,
): WorkbenchEvidence | null {
  if (!row.evidenceId) return null;

  const storagePath = row.storagePath?.trim() || null;
  const externalLink = row.externalLink?.trim() || null;
  const textBody = row.textBody?.trim() || null;
  if (!storagePath && !externalLink && !textBody) return null;

  const kind: WorkbenchEvidence["kind"] = textBody
    ? "text"
    : storagePath
      ? "file"
      : "link";
  const title =
    row.evidenceTitle?.trim() ||
    (kind === "link" ? externalLink : null) ||
    (kind === "text" ? "Comprovação textual" : null) ||
    "Evidência";

  return {
    id: row.evidenceId,
    kind,
    title,
    description: row.evidenceDescription ?? "",
    externalLink,
    storagePath,
    textBody,
    validationStatus: row.validationStatus,
    validatedAt: null,
    submittedAt: "",
    validationJustification: row.validationJustification,
  };
}

/**
 * Fonte única das evidências persistidas exibíveis na workbench.
 * - Coleção `evidences` com itens: usa os itens com comprovação válida.
 * - Coleção ausente ou vazia: tenta o fallback legado válido.
 * - Sem evidência válida: lista vazia (não apaga campos planos residuais).
 */
export function resolvePersistedEvidences(
  row: PersistedEvidenceRow,
): WorkbenchEvidence[] {
  if (row.evidences && row.evidences.length > 0) {
    return row.evidences.filter(hasUsableEvidenceAttachment);
  }

  const legacy = buildLegacyPersistedEvidence(row);
  return legacy ? [legacy] : [];
}

/**
 * Campos planos residuais sem evidência válida resolvida.
 * Serve para diagnóstico — não deve disparar limpeza silenciosa na UI.
 */
export function hasResidualEvidenceFlatFields(
  row: PersistedEvidenceRow,
): boolean {
  if (resolvePersistedEvidences(row).length > 0) return false;
  return Boolean(
    row.evidenceId ||
      row.storagePath?.trim() ||
      row.externalLink?.trim() ||
      row.textBody?.trim() ||
      row.evidenceTitle?.trim(),
  );
}
