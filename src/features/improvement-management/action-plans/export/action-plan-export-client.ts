"use client";

import { z } from "zod";
import writeXlsxFile from "write-excel-file/browser";
import { businessToday } from "@/shared/datetime/business-date";
import { famiPreliminaryLabels } from "@/shared/labels/official-labels";
import { readApiErrorMessage } from "@/shared/validation/runtime";
import type { RespondentRecommendationItem } from "@/features/improvement-management/recommendations/respondent-presentation";
import {
  actionPlanExcelAutoFilterFeature,
  buildActionPlanXlsxSheets,
} from "./action-plan-export-xlsx-sheets";
import {
  getActionPlanExportData,
  toActionPlanExportSourceFromRespondent,
} from "./get-action-plan-export-data";
import type { ActionPlanExportFormat } from "./action-plan-export-types";
import {
  resolveActionPlanExportCycleId,
  ACTION_PLAN_BIMONTHLY_EXPORT_NO_REPORT,
  actionPlanBimonthlyExportErrorMessage,
} from "@/features/improvement-management/monitoring/bimonthly/export-pdf-shared";

const bimonthlyListSchema = z.object({
  history: z.array(z.object({ id: z.string().uuid() })),
});

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

async function downloadLatestBimonthlyTrackingPdf(cycleId: string): Promise<void> {
  const listResponse = await fetch(`/api/monitoring/bimonthly?cycleId=${encodeURIComponent(cycleId)}`, {
    cache: "no-store",
  });
  const listRaw: unknown = await listResponse.json();
  if (!listResponse.ok) {
    throw new Error(readApiErrorMessage(listRaw, famiPreliminaryLabels.loadError));
  }
  const parsed = bimonthlyListSchema.safeParse(listRaw);
  if (!parsed.success || parsed.data.history.length === 0) {
    throw new Error(actionPlanBimonthlyExportErrorMessage(ACTION_PLAN_BIMONTHLY_EXPORT_NO_REPORT));
  }

  const reportId = parsed.data.history[0]!.id;
  const exportResponse = await fetch(
    `/api/monitoring/bimonthly/${reportId}/export?format=pdf`,
    { cache: "no-store" },
  );
  if (!exportResponse.ok) {
    const body: unknown = await exportResponse.json().catch(() => null);
    throw new Error(readApiErrorMessage(body, "Falha ao exportar o relatório bimestral."));
  }
  const blob = await exportResponse.blob();
  const disposition = exportResponse.headers.get("Content-Disposition") ?? "";
  const filename =
    disposition.match(/filename="?([^";]+)"?/i)?.[1] ??
    `relatorio-bimestral-${businessToday()}.pdf`;
  downloadBlob(blob, filename);
}

/**
 * Exportação do plano de integridade e compliance do respondente a partir dos itens já carregados.
 * PDF: relatório bimestral de acompanhamento (mesmo documento da aba Evolução).
 * Excel: planilha analítica por ação.
 */
export async function downloadRespondentActionPlanExport(
  items: readonly RespondentRecommendationItem[],
  format: ActionPlanExportFormat,
): Promise<void> {
  const data = getActionPlanExportData(items.map(toActionPlanExportSourceFromRespondent));
  const fileBaseName = "plano-de-integridade-e-compliance";

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

  const resolvedCycle = resolveActionPlanExportCycleId(
    undefined,
    items.map((item) => item.cycleId),
  );
  if ("error" in resolvedCycle) {
    throw new Error(actionPlanBimonthlyExportErrorMessage(resolvedCycle.error));
  }
  await downloadLatestBimonthlyTrackingPdf(resolvedCycle.cycleId);
}
