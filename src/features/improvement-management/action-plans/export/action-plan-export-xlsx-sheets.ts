import type { Sheet } from "write-excel-file/browser";
import {
  excelAutoFilterFeature,
  xlsxDateCell,
  xlsxHeaderCell,
  xlsxPercentCell,
  xlsxWrapText,
} from "@/shared/export/xlsx-sheet";
import { PORTFOLIO_EXPORT_MISSING_VALUE } from "@/features/improvement-management/recommendations/export/portfolio-export-types";
import type { RecommendationPortfolioExportRow } from "@/features/improvement-management/recommendations/export/portfolio-export-types";
import { ACTION_PLAN_EXPORT_HEADERS } from "./action-plan-export-types";

function textOrMissing(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : PORTFOLIO_EXPORT_MISSING_VALUE;
}

/** Células Excel na ordem canônica — 1 linha por ação, sem mesclar. */
export function actionPlanExportRowToExcelCells(row: RecommendationPortfolioExportRow) {
  return [
    textOrMissing(row.formName),
    textOrMissing(row.organizationName),
    textOrMissing(row.axisName),
    textOrMissing(row.sectionName),
    xlsxWrapText(textOrMissing(row.actionTitle)),
    textOrMissing(row.responsibleSector),
    xlsxDateCell(row.startDate),
    xlsxDateCell(row.endDate),
    textOrMissing(row.actionStatus),
    xlsxPercentCell(row.progress),
    xlsxWrapText(textOrMissing(row.questionText)),
    xlsxWrapText(textOrMissing(row.recommendationText)),
    textOrMissing(row.recommendationStatus),
    xlsxDateCell(row.updatedAt),
  ];
}

export function buildActionPlanXlsxSheets<FileContent>(
  rows: readonly RecommendationPortfolioExportRow[],
): Sheet<FileContent>[] {
  return [
    {
      sheet: "Ações por seção",
      stickyRowsCount: 1,
      dateFormat: "dd/mm/yyyy",
      columns: [
        { width: 32 },
        { width: 36 },
        { width: 16 },
        { width: 24 },
        { width: 40 },
        { width: 22 },
        { width: 12 },
        { width: 12 },
        { width: 18 },
        { width: 12 },
        { width: 48 },
        { width: 48 },
        { width: 24 },
        { width: 18 },
      ],
      data: [
        ACTION_PLAN_EXPORT_HEADERS.map(xlsxHeaderCell),
        ...rows.map(actionPlanExportRowToExcelCells),
      ],
    },
  ];
}

export function actionPlanExcelAutoFilterFeature<FileContent>(rowCount: number) {
  return excelAutoFilterFeature<FileContent>(ACTION_PLAN_EXPORT_HEADERS.length, rowCount);
}

/** Partida do plano: mesma ação, situação inicial e motivo congelado no diagnóstico. */
export const INTEGRITY_PLAN_DEPARTURE_HEADERS = [
  "Formulário",
  "Organização",
  "Eixo",
  "Seção",
  "Ação",
  "Área responsável",
  "Início",
  "Final",
  "Situação na partida",
  "Progresso na partida",
  "Pergunta de origem",
  "Motivo no diagnóstico",
  "Recomendação de origem",
  "Situação da recomendação",
  "Cadastro da ação",
] as const;

export function integrityPlanDepartureRowToExcelCells(row: RecommendationPortfolioExportRow) {
  return [
    textOrMissing(row.formName),
    textOrMissing(row.organizationName),
    textOrMissing(row.axisName),
    textOrMissing(row.sectionName),
    xlsxWrapText(textOrMissing(row.actionTitle)),
    textOrMissing(row.responsibleSector),
    xlsxDateCell(row.startDate),
    xlsxDateCell(row.endDate),
    textOrMissing(row.actionStatus),
    xlsxPercentCell(row.progress),
    xlsxWrapText(textOrMissing(row.questionText)),
    xlsxWrapText(textOrMissing(row.diagnosticOrigin)),
    xlsxWrapText(textOrMissing(row.recommendationText)),
    textOrMissing(row.recommendationStatus),
    xlsxDateCell(row.updatedAt),
  ];
}

export function buildIntegrityPlanDepartureXlsxSheets<FileContent>(
  rows: readonly RecommendationPortfolioExportRow[],
): Sheet<FileContent>[] {
  return [
    {
      sheet: "Partida do plano",
      stickyRowsCount: 1,
      dateFormat: "dd/mm/yyyy",
      columns: [
        { width: 32 },
        { width: 36 },
        { width: 16 },
        { width: 24 },
        { width: 40 },
        { width: 22 },
        { width: 12 },
        { width: 12 },
        { width: 22 },
        { width: 18 },
        { width: 48 },
        { width: 28 },
        { width: 48 },
        { width: 24 },
        { width: 18 },
      ],
      data: [
        INTEGRITY_PLAN_DEPARTURE_HEADERS.map(xlsxHeaderCell),
        ...rows.map(integrityPlanDepartureRowToExcelCells),
      ],
    },
  ];
}

export function integrityPlanDepartureExcelAutoFilterFeature<FileContent>(rowCount: number) {
  return excelAutoFilterFeature<FileContent>(INTEGRITY_PLAN_DEPARTURE_HEADERS.length, rowCount);
}
