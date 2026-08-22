import { CycleDashboard, type CycleDashboardInitialFilters } from "@/features/cycles/components/CycleDashboard";
import { AdminCiclosHero } from "@/features/cycles/components/admin-ciclos-hero";
import { requireRole } from "@/infrastructure/auth/current-user";
import { listCycles } from "@/features/cycles/cycle-queries";
import type { CycleState } from "@/shared/domain/types";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { loadValidationFinalizationReadiness } from "@/features/validation";
import { listFormFilterOptions } from "@/features/admin/filter-catalog";
import { ADMIN_PAGE_HERO_BLEED } from "@/shared/layout/admin-page-layout";
import { layout } from "@/shared/layout/design-system";
import { firstSearchParam } from "@/features/admin/search-params";
import { getOrganizationOptions } from "@/features/organizations/options";
import {
  filterDashboardCycles,
  selectLatestCyclePerOrganization,
  summarize,
  type CollectionFilter,
} from "@/features/cycles/dashboard-model";
import {
  listCyclesForPeriod,
  listFormPeriodsForForm,
  resolveFormPeriodScope,
} from "@/features/cycles/form-period-scope";

const CYCLE_STATES = new Set<CycleState>([
  "draft",
  "in_response",
  "submitted",
  "in_validation",
  "awaiting_adjustment",
  "validated",
  "completed",
]);

export default async function AdminCiclosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const formId = firstSearchParam(params, "formId") ?? "";
  const periodIdParam = firstSearchParam(params, "periodId") ?? "";
  const legacyPeriodLabel = firstSearchParam(params, "periodLabel") ?? "";
  const search = (firstSearchParam(params, "q") ?? "").trim();
  const organizationId = firstSearchParam(params, "organizationId") ?? "";
  const rawState = firstSearchParam(params, "state") ?? "";
  const state = CYCLE_STATES.has(rawState as CycleState) ? (rawState as CycleState) : "";
  const dueParam = firstSearchParam(params, "due");
  const dueFilter = dueParam === "overdue" || dueParam === "in_response" ? dueParam : "all";
  const collectionParam = firstSearchParam(params, "collection");
  const collectionFilter: CollectionFilter =
    collectionParam === "active" || collectionParam === "suspended"
      ? collectionParam
      : "all";

  const initialFilters: CycleDashboardInitialFilters = {
    search,
    organizationId,
    state,
    dueFilter,
    collectionFilter,
  };

  const supabase = createSupabaseServiceRoleClient();
  const [organizations, forms] = await Promise.all([
    getOrganizationOptions(),
    listFormFilterOptions(supabase),
  ]);

  const formOptions = forms.map(({ id, name }) => ({ id, name }));
  const formScope = formId ? formOptions.find((form) => form.id === formId) ?? null : null;

  const periods = formScope
    ? await listFormPeriodsForForm(supabase, formScope.id)
    : [];
  const periodScopeResolved = formScope
    ? resolveFormPeriodScope({
        formId: formScope.id,
        periodId: periodIdParam || null,
        legacyPeriodLabel: legacyPeriodLabel || null,
        periods,
      })
    : null;

  const resolvedPeriodId = periodScopeResolved?.period?.id ?? null;

  const rawCycles = formScope
    ? await listCycles(supabase, {
        formId,
        ...(resolvedPeriodId ? { periodId: resolvedPeriodId } : {}),
      })
    : [];

  // Com periodId: um ciclo por órgão já garantido por UNIQUE(period_id, organization_id).
  // Sem periodId: mantém o recorte "mais recente por órgão" para visão mista.
  const linkedCycles = formScope
    ? resolvedPeriodId
      ? listCyclesForPeriod(rawCycles, resolvedPeriodId)
      : selectLatestCyclePerOrganization(rawCycles)
    : [];

  const now = new Date();
  const orgCycles = filterDashboardCycles(
    linkedCycles,
    {
      search,
      organizationId,
      state,
      dueFilter,
      collectionFilter,
    },
    now,
  );

  const validationReadiness = await loadValidationFinalizationReadiness(
    supabase,
    orgCycles
      .filter((cycle) => cycle.state === "in_validation")
      .map((cycle) => cycle.id),
  );
  const readyToFinalizeCycleIds = validationReadiness
    .filter((item) => item.ready)
    .map((item) => item.cycleId);

  const visibleSummary = summarize(orgCycles, now);
  const metrics = formScope
    ? {
        linked: linkedCycles.length,
        visible: visibleSummary.total,
        overdue: visibleSummary.overdue,
      }
    : { linked: 0, visible: 0, overdue: 0 };

  const periodOptions = periods.map((period) => ({
    id: period.id,
    label: period.label,
    periodCode: period.periodCode,
  }));

  return (
    <div className={layout.pageStack}>
      <div className={ADMIN_PAGE_HERO_BLEED}>
        <AdminCiclosHero formId={formId} />
      </div>

      <CycleDashboard
        cycles={orgCycles}
        metrics={metrics}
        forms={formOptions}
        organizations={organizations}
        page={1}
        pageSize={Math.max(orgCycles.length, 1)}
        totalPages={1}
        formScope={formScope}
        periodScope={periodScopeResolved?.period ?? null}
        periodOptions={periodOptions}
        periodBaseDeadlineAt={periodScopeResolved?.period?.responseDeadlineAt ?? null}
        requireFormSelection={!formScope}
        initialFilters={initialFilters}
        readyToFinalizeCycleIds={readyToFinalizeCycleIds}
      />
    </div>
  );
}
