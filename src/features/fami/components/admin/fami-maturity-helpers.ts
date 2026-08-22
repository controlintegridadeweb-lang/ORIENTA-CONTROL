import type { FamiSnapshotResponse } from "@/features/fami/client";
import { createCsvContent, downloadCsvFile } from "@/shared/export/csv";

export type TabId = "resumo" | "eixos" | "secoes" | "evolucao";

/** Ritmo vertical entre grandes blocos da tela Maturidade FAMI. */
export const FAMI_SECTION_STACK = "space-y-10 lg:space-y-12";

export type FamiSnapshotNonNull = NonNullable<FamiSnapshotResponse["snapshot"]>;
type Snapshot = FamiSnapshotNonNull;

export type FamiMode = "admin" | "respondent";

/** Constrói links operacionais para as filas de admin (ou null fora do escopo admin). */
export type QueueHrefFn = (
  segment: "evidencias" | "recomendacoes" | "plano-acao",
  params: Record<string, string>,
) => string | null;

/** Monta o conteúdo CSV do snapshot (sem I/O). */
export function buildFamiCsv(
  snapshot: Snapshot,
  options: { globalLabel?: string } = {},
): string {
  const globalLabel = options.globalLabel ?? "Global";
  const rows: unknown[][] = [
    ["Escopo", "Nome", "Percentual", "Nível", "Pontos obtidos", "Pontos possíveis"],
    [
      "Global",
      globalLabel,
      snapshot.global?.maturityLevel == null ? "" : snapshot.global.percentage.toFixed(2),
      snapshot.global ? (snapshot.global.maturityLevel ?? "N/A") : "",
      snapshot.global?.pointsObtained.toFixed(2) ?? "",
      snapshot.global?.pointsPossible.toFixed(2) ?? "",
    ],
    ...snapshot.axes.map((axis) => [
      "Eixo",
      axis.axisName,
      axis.maturityLevel == null ? "" : axis.percentage.toFixed(2),
      axis.maturityLevel ?? "N/A",
      "",
      "",
    ]),
    ...snapshot.sections.map((section) => [
      "Seção",
      section.sectionName,
      section.maturityLevel == null ? "" : section.percentage.toFixed(2),
      section.maturityLevel ?? "N/A",
      section.pointsObtained.toFixed(2),
      section.pointsPossible.toFixed(2),
    ]),
  ];
  return createCsvContent(rows);
}

/** Dispara o download do CSV no browser. */
export function downloadFamiCsv(csv: string, fileName: string): void {
  downloadCsvFile(csv, fileName);
}
