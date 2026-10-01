"use client";

import writeXlsxFile from "write-excel-file/browser";
import type { RespondentRecommendationItem } from "@/features/improvement-management/recommendations/respondent-presentation";
import {
  getActionPlanExportData,
  toDepartureActionPlanSourceFromRespondent,
} from "./get-action-plan-export-data";
import { generateActionPlanPdf } from "./action-plan-export-pdf";
import {
  buildIntegrityPlanDepartureXlsxSheets,
  integrityPlanDepartureExcelAutoFilterFeature,
} from "./action-plan-export-xlsx-sheets";

export type IntegrityPlanReportFormat = "pdf" | "xlsx";

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
 * Exporta a partida do plano de integridade e compliance a partir dos itens
 * já carregados. O progresso posterior permanece nos relatórios de monitoramento.
 */
export async function downloadIntegrityPlanDepartureReport(
  items: readonly RespondentRecommendationItem[],
  format: IntegrityPlanReportFormat,
): Promise<void> {
  const data = {
    ...getActionPlanExportData(items.map(toDepartureActionPlanSourceFromRespondent)),
    variant: "departure" as const,
  };
  if (data.rows.length === 0) {
    throw new Error("Nenhuma ação cadastrada para exportar a partida do plano.");
  }

  if (format === "pdf") {
    const pdf = await generateActionPlanPdf(data);
    const bytes = Uint8Array.from(pdf.content);
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), pdf.filename);
    return;
  }

  type BrowserFileContent = Blob | ArrayBuffer | File;
  const sheets = buildIntegrityPlanDepartureXlsxSheets<BrowserFileContent>(data.rows);
  await writeXlsxFile(sheets, {
    fontFamily: "Arial",
    fontSize: 10,
    features: [
      integrityPlanDepartureExcelAutoFilterFeature<BrowserFileContent>(data.rows.length),
    ],
  }).toFile(`relatorio-plano-de-integridade-e-compliance-${data.issuedOn}.xlsx`);
}
