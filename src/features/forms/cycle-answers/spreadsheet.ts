import type { AnswerValue } from "@/shared/domain/types";
import { perguntaLabels } from "@/shared/labels/official-labels";
import {
  excelAutoFilterFeature,
  xlsxHeaderCell,
  xlsxWrapText,
} from "@/shared/export/xlsx-sheet";
import type { Feature, Sheet } from "write-excel-file/browser";

export const CYCLE_ANSWERS_EXPORT_HEADERS = [
  "Nº",
  "Eixo",
  "Seção",
  "Pergunta",
  "Resposta",
  "Observações",
  "Comprovações",
  "Organização",
  "Período",
  "Diagnóstico",
] as const;

export type CycleAnswerSource = {
  orderIndex: number;
  prompt: string;
  answer: AnswerValue | null;
  notes: string | null;
  isWaived: boolean;
  waiverReason: string | null;
  isNotApplicable: boolean;
  evidences: Array<{ title: string }>;
};

export type QuestionLocation = {
  axisName: string;
  sectionName: string;
};

export type CycleAnswerSpreadsheetRow = {
  order: number;
  axisName: string;
  sectionName: string;
  prompt: string;
  answer: string;
  notes: string | null;
  evidences: string | null;
};

export type CycleAnswersSpreadsheet = {
  formName: string;
  organizationName: string;
  periodLabel: string;
  rows: CycleAnswerSpreadsheetRow[];
};

function filled(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

export function cycleAnswerLabel(answer: Pick<
  CycleAnswerSource,
  "answer" | "isWaived" | "isNotApplicable"
>): string {
  if (answer.isWaived) return perguntaLabels.notApplicableForOrganization;
  if (answer.isNotApplicable || answer.answer === "not_applicable") {
    return perguntaLabels.notApplicableInDiagnosis;
  }
  if (answer.answer === "yes") return "Sim";
  if (answer.answer === "no") return "Não";
  return "Sem resposta";
}

export function cycleAnswerNotes(
  answer: Pick<CycleAnswerSource, "notes" | "isWaived" | "waiverReason">,
): string | null {
  const notes = filled(answer.notes);
  const reason = answer.isWaived ? filled(answer.waiverReason) : null;
  if (notes && reason && notes !== reason) return `${notes}\n${reason}`;
  return notes ?? reason;
}

export function cycleAnswerEvidences(
  answer: Pick<CycleAnswerSource, "evidences">,
): string | null {
  const titles = answer.evidences
    .map((item) => item.title.trim())
    .filter(Boolean);
  return titles.length > 0 ? titles.join("; ") : null;
}

export function mapCycleAnswerRow(
  answer: CycleAnswerSource,
  location: QuestionLocation | null,
): CycleAnswerSpreadsheetRow {
  return {
    order: answer.orderIndex + 1,
    axisName: location?.axisName.trim() ?? "",
    sectionName: location?.sectionName.trim() ?? "",
    prompt: answer.prompt.trim(),
    answer: cycleAnswerLabel(answer),
    notes: cycleAnswerNotes(answer),
    evidences: cycleAnswerEvidences(answer),
  };
}

function filenamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();
}

export function cycleAnswersFilename(input: {
  formName: string;
  organizationName: string;
  periodLabel: string;
}): string {
  const slug = [input.formName, input.organizationName, input.periodLabel]
    .map(filenamePart)
    .filter(Boolean)
    .join("-");
  return `respostas-${slug || "diagnostico"}.xlsx`;
}

function textCell(value: string) {
  const trimmed = value.trim();
  return trimmed ? xlsxWrapText(trimmed) : null;
}

export function buildCycleAnswersXlsxSheets<FileContent>(
  data: CycleAnswersSpreadsheet,
): Sheet<FileContent>[] {
  return [
    {
      sheet: "Respostas",
      stickyRowsCount: 1,
      columns: [
        { width: 8 },
        { width: 24 },
        { width: 26 },
        { width: 56 },
        { width: 32 },
        { width: 36 },
        { width: 36 },
        { width: 28 },
        { width: 16 },
        { width: 32 },
      ],
      data: [
        CYCLE_ANSWERS_EXPORT_HEADERS.map(xlsxHeaderCell),
        ...data.rows.map((row) => [
          row.order,
          textCell(row.axisName),
          textCell(row.sectionName),
          xlsxWrapText(row.prompt),
          xlsxWrapText(row.answer),
          row.notes ? xlsxWrapText(row.notes) : null,
          row.evidences ? xlsxWrapText(row.evidences) : null,
          data.organizationName,
          data.periodLabel,
          data.formName,
        ]),
      ],
    },
  ];
}

export function cycleAnswersExcelAutoFilterFeature<FileContent>(
  rowCount: number,
): Feature<FileContent> {
  return excelAutoFilterFeature<FileContent>(CYCLE_ANSWERS_EXPORT_HEADERS.length, rowCount);
}
