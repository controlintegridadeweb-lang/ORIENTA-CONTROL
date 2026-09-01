import "server-only";

import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";
import { buildBimonthlyTrackingPdf } from "@/features/reports/pdf/build-bimonthly-tracking-pdf";
import { loadBimonthlyReportDetail } from "./detail";
import { listBimonthlyReports, type BimonthlyReportListItem } from "./read";
import {
  ACTION_PLAN_BIMONTHLY_EXPORT_NO_REPORT,
  resolveActionPlanExportCycleId,
} from "./export-pdf-shared";

export {
  ACTION_PLAN_BIMONTHLY_EXPORT_AMBIGUOUS_CYCLE,
  ACTION_PLAN_BIMONTHLY_EXPORT_NO_CYCLE,
  ACTION_PLAN_BIMONTHLY_EXPORT_NO_REPORT,
  actionPlanBimonthlyExportErrorMessage,
  resolveActionPlanExportCycleId,
} from "./export-pdf-shared";

export async function resolveLatestBimonthlyReportForExport(
  client: TypedSupabaseClient,
  cycleId: string,
  referenceYear?: number,
): Promise<BimonthlyReportListItem | null> {
  const { history } = await listBimonthlyReports(client, cycleId, referenceYear);
  return history[0] ?? null;
}

/** Mesmo PDF institucional gerado na aba Evolução (relatório bimestral de acompanhamento). */
export async function buildLatestBimonthlyTrackingPdfForCycle(
  client: TypedSupabaseClient,
  cycleId: string,
  referenceYear?: number,
): Promise<{ filename: string; bytes: Uint8Array }> {
  const report = await resolveLatestBimonthlyReportForExport(client, cycleId, referenceYear);
  if (!report) {
    throw new Error(ACTION_PLAN_BIMONTHLY_EXPORT_NO_REPORT);
  }
  const detail = await loadBimonthlyReportDetail(client, report.id);
  if (!detail) {
    throw new Error(ACTION_PLAN_BIMONTHLY_EXPORT_NO_REPORT);
  }
  return buildBimonthlyTrackingPdf({ snapshot: detail, client });
}
