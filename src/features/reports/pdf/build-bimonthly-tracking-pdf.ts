import { businessToday } from "@/shared/datetime/business-date";
import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";
import { loadOfficialReportData } from "./build-official-report-data";
import { buildOfficialReportPdfDocument } from "./pdf/build-official-report";
import {
  BIMONTHLY_TRACKING_OFFICIAL_BASE_MISSING,
  overlayBimonthlyTrackingOnOfficialReport,
  type BimonthlyTrackingSnapshot,
} from "./overlay-bimonthly-tracking";

export function bimonthlyTrackingPdfFilename(
  snapshot: Pick<BimonthlyTrackingSnapshot, "referenceYear" | "bimester">,
): string {
  return `relatorio-bimestral-${snapshot.referenceYear}-b${snapshot.bimester}-${businessToday()}.pdf`;
}

/**
 * Monta o PDF do plano de integridade e compliance no corte do bimestre.
 * Não inclui Resultado FAMI; o relatório anual permanece o documento oficial de maturidade.
 */
export async function buildBimonthlyTrackingPdf(params: {
  snapshot: BimonthlyTrackingSnapshot;
  client: TypedSupabaseClient;
}): Promise<{ filename: string; bytes: Uint8Array }> {
  const data = await loadOfficialReportData(
    { cycleId: params.snapshot.cycleId, allowOpenActionPlan: true },
    params.client,
  );
  if (!data) {
    throw new Error(BIMONTHLY_TRACKING_OFFICIAL_BASE_MISSING);
  }
  const payload = overlayBimonthlyTrackingOnOfficialReport(data, params.snapshot);
  return {
    filename: bimonthlyTrackingPdfFilename(params.snapshot),
    bytes: await buildOfficialReportPdfDocument(payload),
  };
}
