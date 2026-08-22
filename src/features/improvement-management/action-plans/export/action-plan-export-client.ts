"use client";

import writeXlsxFile from "write-excel-file/browser";
import { businessToday } from "@/shared/datetime/business-date";
import type { RespondentRecommendationItem } from "@/features/improvement-management/recommendations/respondent-presentation";
import { generateActionPlanPdf } from "./action-plan-export-pdf";
import {
  actionPlanExcelAutoFilterFeature,
  buildActionPlanXlsxSheets,
} from "./action-plan-export-xlsx-sheets";
import {
  getActionPlanExportData,
  toActionPlanExportSourceFromRespondent,
} from "./get-action-plan-export-data";
import type { ActionPlanExportFormat } from "./action-plan-export-types";

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
 * Exportação do plano de ação do respondente a partir dos itens já carregados.
 * Sem N+1: usa os `plans` embutidos. Sem histórico inventado.
 */
export async function downloadRespondentActionPlanExport(
  items: readonly RespondentRecommendationItem[],
  format: ActionPlanExportFormat,
): Promise<void> {
  const data = getActionPlanExportData(items.map(toActionPlanExportSourceFromRespondent));
  const fileBaseName = "plano-de-acao";

  if (format === "xlsx") {
    type BrowserFileContent = Blob | ArrayBuffer | File;
    const sheets = buildActionPlanXlsxSheets<BrowserFileContent>(data.rows);
    await writeXlsxFile(sheets, {
      fontFamily: "Arial",
      fontSize: 10,
      features: [actionPlanExcelAutoFilterFeature<BrowserFileContent>(data.rows.length)],
    }).toFile(`${fileBaseName}-${businessToday()}.xlsx`);
    return;
  }

  const pdf = await generateActionPlanPdf(data);
  const bytes = Uint8Array.from(pdf.content);
  downloadBlob(new Blob([bytes], { type: "application/pdf" }), pdf.filename);
}
