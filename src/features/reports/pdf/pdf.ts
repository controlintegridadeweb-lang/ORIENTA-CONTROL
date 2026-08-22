import type { OfficialReportData } from "@/features/reports/pdf/report-types";
import { buildOfficialReportPdfDocument } from "@/features/reports/pdf/pdf/build-official-report";

/** Gera o PDF oficial institucional a partir do payload consolidado. */
export async function buildOfficialReportPdf(payload: OfficialReportData): Promise<Uint8Array> {
  return buildOfficialReportPdfDocument(payload);
}
