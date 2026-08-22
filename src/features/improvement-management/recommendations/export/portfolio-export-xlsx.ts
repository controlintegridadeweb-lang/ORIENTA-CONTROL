import writeXlsxFile from "write-excel-file/node";
import { businessToday } from "@/shared/datetime/business-date";
import type { RecommendationPortfolioExportRow } from "./portfolio-export-types";
import {
  buildRecommendationPortfolioXlsxSheets,
  portfolioExcelAutoFilterFeature,
} from "./portfolio-export-xlsx-sheets";

type NodeFileContent = Buffer | import("node:stream").Stream | import("node:buffer").Blob;

export async function buildRecommendationPortfolioXlsx(
  rows: readonly RecommendationPortfolioExportRow[],
): Promise<{ filename: string; content: Buffer }> {
  const sheets = buildRecommendationPortfolioXlsxSheets<NodeFileContent>(rows);
  const features = [portfolioExcelAutoFilterFeature<NodeFileContent>(rows.length)];
  const file = await writeXlsxFile(sheets, {
    fontFamily: "Arial",
    fontSize: 10,
    features,
  }).toBuffer();

  return {
    filename: `portfolio-recomendacoes-${businessToday()}.xlsx`,
    content: Buffer.from(file),
  };
}
