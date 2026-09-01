import "server-only";

import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";
import { loadBimonthlyReportDetail, type BimonthlyReportDetail } from "./detail";
import { listBimonthlyReports, type BimonthlyReportListItem } from "./read";
import { ACTION_PLAN_BIMONTHLY_EXPORT_NO_REPORT } from "./export-pdf-shared";

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

/** Snapshot mais recente do bimestre, para a rota montar o PDF institucional em reports. */
export async function loadLatestBimonthlyDetailForExport(
  client: TypedSupabaseClient,
  cycleId: string,
  referenceYear?: number,
): Promise<BimonthlyReportDetail> {
  const report = await resolveLatestBimonthlyReportForExport(client, cycleId, referenceYear);
  if (!report) {
    throw new Error(ACTION_PLAN_BIMONTHLY_EXPORT_NO_REPORT);
  }
  const detail = await loadBimonthlyReportDetail(client, report.id);
  if (!detail) {
    throw new Error(ACTION_PLAN_BIMONTHLY_EXPORT_NO_REPORT);
  }
  return detail;
}
