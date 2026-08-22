import writeXlsxFile from "write-excel-file/node";
import { businessToday } from "@/shared/datetime/business-date";
import type { ActionPlanExportData } from "./action-plan-export-types";
import type { RecommendationPortfolioExportRow } from "@/features/improvement-management/recommendations/export/portfolio-export-types";
import {
  actionPlanExcelAutoFilterFeature,
  buildActionPlanXlsxSheets,
} from "./action-plan-export-xlsx-sheets";

type NodeFileContent = Buffer | import("node:stream").Stream | import("node:buffer").Blob;

export async function buildActionPlanXlsx(
  rows: readonly RecommendationPortfolioExportRow[],
): Promise<{ filename: string; content: Buffer }> {
  const sheets = buildActionPlanXlsxSheets<NodeFileContent>(rows);
  const file = await writeXlsxFile(sheets, {
    fontFamily: "Arial",
    fontSize: 10,
    features: [actionPlanExcelAutoFilterFeature<NodeFileContent>(rows.length)],
  }).toBuffer();

  return {
    filename: `plano-de-acao-${businessToday()}.xlsx`,
    content: Buffer.from(file),
  };
}

export async function generateActionPlanExcel(
  data: ActionPlanExportData,
): Promise<{ filename: string; content: Buffer }> {
  return buildActionPlanXlsx(data.rows);
}
