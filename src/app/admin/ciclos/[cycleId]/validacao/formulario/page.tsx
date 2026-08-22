import { notFound, redirect } from "next/navigation";
import { firstSearchParam } from "@/features/admin/search-params";
import { getCycleDetail } from "@/features/cycles/cycle-queries";
import {
  loadValidationFormPage,
  resolveValidationFormQuery,
} from "@/features/validation";
import { ValidationFullFormView } from "@/features/validation/components/ValidationFullFormView";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { withAdminReturnPath } from "@/shared/navigation/admin-navigation-context";
import { parseUuidParam } from "@/shared/validation/uuid";

type Props = {
  params: Promise<{ cycleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminCicloValidacaoFormularioPage({
  params,
  searchParams,
}: Props) {
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

  const query = resolveValidationFormQuery(sp);
  const page = await loadValidationFormPage(supabase, cycle.id, query);

  return (
    <ValidationFullFormView
      cycleId={cycle.id}
      organizationName={cycle.organizationName}
      formName={cycle.formName}
      periodLabel={cycle.periodLabel}
      returnTo={returnTo}
      filaReturnQuery={query.filaReturnQuery}
      initialCriteria={page.criteria}
      formSummary={page.formSummary}
      formSections={page.formSections}
      pagination={{
        page: page.page,
        pageSize: page.pageSize,
        totalItems: page.totalItems,
        sectionId: page.sectionId,
        axisId: page.axisId,
        answer: page.answer,
        situation: page.situation,
        decision: page.decision,
        proof: page.proof,
        search: page.search,
      }}
    />
  );
}
