import { notFound } from "next/navigation";
import { AdminCycleDetail } from "@/features/cycles/components/admin-cycle-detail";
import { getCycleDetail } from "@/features/cycles/cycle-queries";
import { firstSearchParam } from "@/features/admin/search-params";
import { loadActionPlanCompletionReadiness } from "@/features/improvement-management/action-plans/completion-readiness";
import { CycleClosureService } from "@/application/reporting/cycle-closure-service";
import { isMissingSchemaCacheError } from "@/infrastructure/api/domain-errors";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { parseUuidParam } from "@/shared/validation/uuid";

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
    try {
      reportLifecycleStatus = await new CycleClosureService(supabase).reportStatus(cycle.id);
    } catch (error) {
      if (!isMissingSchemaCacheError(error)) throw error;
    }
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
