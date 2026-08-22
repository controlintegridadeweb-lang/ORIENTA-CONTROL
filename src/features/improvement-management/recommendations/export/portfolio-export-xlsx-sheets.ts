import type { Feature, Sheet } from "write-excel-file/browser";
import {
  excelAutoFilterFeature,
  xlsxDateCell,
  xlsxDateTimeCell,
  xlsxHeaderCell,
  xlsxPercentCell,
  xlsxWrapText,
} from "@/shared/export/xlsx-sheet";
import { RECOMMENDATION_PORTFOLIO_EXPORT_HEADERS } from "./portfolio-export-types";
import type { RecommendationPortfolioExportRow } from "./portfolio-export-types";

/** Dados da planilha sem I/O — testável e reutilizável (node/browser). */
export function buildRecommendationPortfolioXlsxSheets<FileContent>(
  rows: readonly RecommendationPortfolioExportRow[],
): Sheet<FileContent>[] {
  return [
    {
      sheet: "Portfólio",
      stickyRowsCount: 1,
      dateFormat: "dd/mm/yyyy",
      columns: [
        { width: 28 },
        { width: 10 },
        { width: 12 },
        { width: 36 },
        { width: 16 },
        { width: 24 },
        { width: 48 },
        { width: 48 },
        { width: 22 },
        { width: 40 },
        { width: 22 },
        { width: 12 },
        { width: 12 },
        { width: 18 },
        { width: 12 },
        { width: 18 },
      ],
      data: [
        RECOMMENDATION_PORTFOLIO_EXPORT_HEADERS.map(xlsxHeaderCell),
        ...rows.map((row) => [
          row.formName,
          row.formVersion,
          row.period,
          row.organizationName,
          row.axisName,
          row.sectionName,
          xlsxWrapText(row.questionText),
          xlsxWrapText(row.recommendationText),
          row.recommendationStatus,
          row.actionTitle ? xlsxWrapText(row.actionTitle) : null,
          row.responsibleName,
          xlsxDateCell(row.startDate),
          xlsxDateCell(row.endDate),
          row.actionStatus,
          xlsxPercentCell(row.progress),
          xlsxDateTimeCell(row.updatedAt),
        ]),
      ],
    },
  ];
}

export function portfolioExcelAutoFilterFeature<FileContent>(
  rowCount: number,
): Feature<FileContent> {
  return excelAutoFilterFeature<FileContent>(
    RECOMMENDATION_PORTFOLIO_EXPORT_HEADERS.length,
    rowCount,
  );
}
