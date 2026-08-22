"use client";

import writeXlsxFile from "write-excel-file/browser";
import {
  buildRecommendationPortfolioExportRows,
  toPortfolioExportSourceFromRespondent,
} from "@/features/improvement-management/recommendations/export/build-portfolio-export-rows";
import { buildRecommendationPortfolioCsv } from "@/features/improvement-management/recommendations/export/portfolio-export-csv";
import { buildRecommendationPortfolioPdf } from "@/features/improvement-management/recommendations/export/portfolio-export-pdf";
import {
  buildRecommendationPortfolioXlsxSheets,
  portfolioExcelAutoFilterFeature,
} from "@/features/improvement-management/recommendations/export/portfolio-export-xlsx-sheets";
import type { RecommendationPortfolioExportFormat } from "@/features/improvement-management/recommendations/export/portfolio-export-types";
import type { RespondentRecommendationItem } from "@/features/improvement-management/recommendations/respondent-presentation";
import { businessToday } from "@/shared/datetime/business-date";
import { downloadCsvFile } from "@/shared/export/csv";

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Exportação do portfólio respondente a partir dos itens já carregados
 * (filtros aplicados no client; planos embutidos — sem N+1).
 */
export async function downloadRespondentPortfolioExport(
  items: readonly RespondentRecommendationItem[],
  format: RecommendationPortfolioExportFormat,
  fileBaseName = "portfolio-recomendacoes",
): Promise<void> {
  const rows = buildRecommendationPortfolioExportRows(
    items.map(toPortfolioExportSourceFromRespondent),
  );

  if (format === "csv") {
    const csv = buildRecommendationPortfolioCsv(rows, fileBaseName);
    downloadCsvFile(csv.content, csv.filename);
    return;
  }

  if (format === "xlsx") {
    type BrowserFileContent = Blob | ArrayBuffer | File;
    const sheets = buildRecommendationPortfolioXlsxSheets<BrowserFileContent>(rows);
    await writeXlsxFile(sheets, {
      fontFamily: "Arial",
      fontSize: 10,
      features: [portfolioExcelAutoFilterFeature<BrowserFileContent>(rows.length)],
    }).toFile(`${fileBaseName}-${businessToday()}.xlsx`);
    return;
  }

  const pdf = await buildRecommendationPortfolioPdf(rows);
  const bytes = Uint8Array.from(pdf.content);
  downloadBlob(new Blob([bytes], { type: "application/pdf" }), pdf.filename);
}
