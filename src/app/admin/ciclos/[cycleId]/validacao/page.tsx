import { notFound, redirect } from "next/navigation";
import { firstSearchParam } from "@/features/admin/search-params";
import { getCycleDetail } from "@/features/cycles/cycle-queries";
import {
  cycleHasValidationReopen,
  loadValidationFormPage,
  loadValidationQueueProgress,
  resolveValidationQueueQuery,
} from "@/features/validation";
import { ValidationFormShell } from "@/features/validation/components/ValidationFormShell";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { withAdminReturnPath } from "@/shared/navigation/admin-navigation-context";
import { parseUuidParam } from "@/shared/validation/uuid";

type Props = {
  params: Promise<{ cycleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminCicloValidacaoPage({ params, searchParams }: Props) {
  const { cycleId: rawId } = await params;
  const cycleId = parseUuidParam(rawId);
  if (!cycleId) notFound();

  const supabase = createSupabaseServiceRoleClient();
  const cycle = await getCycleDetail(supabase, cycleId);
  if (!cycle) notFound();

  const sp = await searchParams;
  const returnTo = firstSearchParam(sp, "returnTo");
  if (cycle.state !== "in_validation") {
    redirect(withAdminReturnPath(`/admin/ciclos/${cycle.id}`, returnTo));
  }

  const query = resolveValidationQueueQuery(sp);
  const [page, progress, validationReopened] = await Promise.all([
    loadValidationFormPage(supabase, cycle.id, query),
    loadValidationQueueProgress(supabase, cycle.id),
    cycleHasValidationReopen(supabase, cycle.id),
  ]);

  return (
    <ValidationFormShell
      cycleId={cycle.id}
      organizationName={cycle.organizationName}
      formName={cycle.formName}
      periodLabel={cycle.periodLabel}
      returnTo={returnTo}
      initialCriteria={page.criteria}
      formSummary={page.formSummary}
      formSections={page.formSections}
      validationReopened={validationReopened}
      targetEvidenceId={query.targetEvidenceId}
      pagination={{
        page: page.page,
        pageSize: page.pageSize,
        totalItems: page.totalItems,
        sectionId: page.sectionId,
        axisId: page.axisId,
        queueSituation: page.queueSituation,
        search: page.search,
      }}
      progress={progress}
    />
  );
}
