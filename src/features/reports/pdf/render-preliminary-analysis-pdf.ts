import "server-only";

import type { PreliminaryExportDetail } from "@/features/fami/server";
import { OrientaPdfDocument } from "@/features/reports/pdf/pdf/document";
import { renderDetailedAnalysisOverviewContent } from "@/features/reports/pdf/pdf/sections/detailed-analysis-overview-section";
import { buildPreliminaryExportReportData } from "./build-preliminary-report-stub";

export async function renderPreliminaryDetailedAnalysisPdf(
  detail: PreliminaryExportDetail,
): Promise<Uint8Array | null> {
  if (detail.famiByAxis.length === 0 && detail.famiSections.length === 0) {
    return null;
  }

  const doc = await OrientaPdfDocument.create(buildPreliminaryExportReportData(detail));
  let cur = doc.beginMajorSection(
    "Análise detalhada",
    "Desempenho preliminar do FAMI por eixo e por seção.",
    "preliminary-detailed-analysis",
  );
  cur = renderDetailedAnalysisOverviewContent(doc, cur);
  void cur;
  return doc.pdf.save();
}
