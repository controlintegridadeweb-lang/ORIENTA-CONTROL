import { notFound } from "next/navigation";
import { AdminCycleDetail } from "@/features/cycles/components/admin-cycle-detail";
import { getCycleDetail } from "@/features/cycles/cycle-queries";
import { firstSearchParam } from "@/features/admin/search-params";
import { loadActionPlanCompletionReadiness } from "@/features/improvement-management/action-plans/completion-readiness";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { parseUuidParam } from "@/shared/validation/uuid";
import { reportLifecycleStatusSchema } from "@/shared/domain/report-lifecycle";

type Props = {
  params: Promise<{ cycleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminCicloDetailPage({ params, searchParams }: Props) {
  const { cycleId: rawId } = await params;
  const cycleId = parseUuidParam(rawId);
  if (!cycleId) notFound();

  const supabase = createSupabaseServiceRoleClient();
  const cycle = await getCycleDetail(supabase, cycleId);
  if (!cycle) notFound();

  const sp = await searchParams;
  const completionReadiness =
    cycle.state === "validated"
      ? await loadActionPlanCompletionReadiness(supabase, cycle.id)
      : null;
  let reportLifecycleStatus = null;
  if (cycle.state === "completed") {
    const { data, error } = await supabase.rpc("cycle_report_lifecycle_status", {
      p_cycle_id: cycle.id,
    });
    if (error) throw error;
    reportLifecycleStatus = reportLifecycleStatusSchema.parse(data);
  }

  return (
    <AdminCycleDetail
      cycle={cycle}
      returnTo={firstSearchParam(sp, "returnTo")}
      validationFlag={firstSearchParam(sp, "validation")}
      completionReadiness={completionReadiness}
      reportLifecycleStatus={reportLifecycleStatus}
    />
  );
}
