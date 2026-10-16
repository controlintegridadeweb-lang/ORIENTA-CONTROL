import type { Feature, Sheet } from "write-excel-file/browser";
import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import {
  excelAutoFilterFeature,
  xlsxHeaderCell,
  xlsxWrapText,
} from "@/shared/export/xlsx-sheet";
import { STATUS_BADGE_META } from "./status-groups";
import type { RespondentEvidenceItem } from "./respondent-contracts";

export const RESPONDENT_EVIDENCE_EXPORT_HEADERS = [
  "Versão",
  "Período",
  "Eixo",
  "Seção",
  "Pergunta",
  "Título",
  "Tipo",
  "Situação",
  "Enviado",
  "Link / texto / documento",
] as const;

function evidenceKindLabel(evidenceType: string): string {
  switch (evidenceType) {
    case "text":
      return "Textual";
    case "link":
      return "Link";
    case "file":
      return "Anexada";
    case "proof_request":
      return "Solicitada";
    default:
      return "Comprovação";
  }
}

/** Nome do arquivo depois de `{uuid}-` no caminho do bucket. */
function documentName(storagePath: string | null): string | null {
  const base = storagePath?.trim().split("/").pop()?.trim() ?? "";
  if (!base) return null;
  const named = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i.exec(base);
  return (named?.[1] || base).trim() || null;
}

/** Conteúdo enviado: URL, texto ou nome do documento, conforme o tipo. */
function submittedEvidence(item: RespondentEvidenceItem): string | null {
  switch (item.evidenceType) {
    case "text":
      return item.textBody?.trim() || null;
    case "link":
      return item.externalLink?.trim() || null;
    case "file":
      return documentName(item.storagePath);
    default:
      return null;
  }
}

function submittedAtCell(iso: string) {
  const formatted = formatPlatformDateTime(
    iso,
    { dateStyle: "short", timeStyle: "short" },
    "",
  );
  return formatted || null;
}

/** Dados da planilha sem I/O — testável no node e reutilizado na geração do arquivo. */
export function buildRespondentEvidenceXlsxSheets<FileContent>(
  items: readonly RespondentEvidenceItem[],
): Sheet<FileContent>[] {
  return [
    {
      sheet: "Evidências",
      stickyRowsCount: 1,
      columns: [
        { width: 10 },
        { width: 16 },
        { width: 22 },
        { width: 24 },
        { width: 48 },
        { width: 28 },
        { width: 16 },
        { width: 28 },
        { width: 20 },
        { width: 48 },
      ],
      data: [
        RESPONDENT_EVIDENCE_EXPORT_HEADERS.map(xlsxHeaderCell),
        ...items.map((item) => {
          const evidence = submittedEvidence(item);
          return [
            item.formVersion,
            item.periodLabel,
            item.axisName,
            item.sectionName,
            xlsxWrapText(item.questionPrompt),
            item.title,
            evidenceKindLabel(item.evidenceType),
            STATUS_BADGE_META[item.respondentStatus].label,
            submittedAtCell(item.submittedAt),
            evidence ? xlsxWrapText(evidence) : null,
          ];
        }),
      ],
    },
  ];
}

export function respondentEvidenceExcelAutoFilterFeature<FileContent>(
  rowCount: number,
): Feature<FileContent> {
  return excelAutoFilterFeature<FileContent>(
    RESPONDENT_EVIDENCE_EXPORT_HEADERS.length,
    rowCount,
  );
}
