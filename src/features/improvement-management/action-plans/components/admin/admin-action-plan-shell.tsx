"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminMonitoringWorkspace } from "@/shared/ui/admin/admin-monitoring-workspace";
import {
  AdminMonitoringViewSwitcher,
  type AdminMonitoringViewMode,
} from "@/features/improvement-management/monitoring/components/admin-monitoring-view-switcher";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { TableSkeleton } from "@/shared/ui/components/loading";
import { exportAdminActionPlans } from "@/features/improvement-management/monitoring/client";
import type { AdminActionPlanMonitoringQuery } from "@/features/improvement-management/monitoring/types";
import { parseAdminListUrlFilters } from "@/shared/config/admin-list-url";
import { useAdminMonitoringListControls } from "@/features/improvement-management/monitoring/hooks/use-admin-monitoring-list-controls";
import { useAdminMonitoringPresentation } from "@/features/improvement-management/monitoring/hooks/use-admin-monitoring-presentation";
import { AdminActionPlanEmptyState } from "./admin-action-plan-empty-state";
import {
  AdminActionPlanFilters,
  initialAdminPlanFilters,
  type AdminPlanFiltersState,
} from "./admin-action-plan-filters";
import { AdminActionPlanList } from "./admin-action-plan-list";
import { AdminActionPlanOrganizationView } from "./admin-action-plan-organization-view";
import { AdminActionPlanSummaryCards } from "./admin-action-plan-summary-cards";
import { AdminActionPlanHero } from "./admin-action-plan-hero";
import { useAdminActionPlans } from "./hooks/use-admin-action-plans";
import { adminBimonthlyReportsPath } from "@/shared/navigation/report-paths";

type Props = {
  initialFilters?: Partial<AdminPlanFiltersState>;
  initialViewMode?: AdminMonitoringViewMode;
};

const PAGE_SIZE = 10;
const PLAN_CARD_FILTERS = ["in_progress", "completed", "overdue"] as const;

export function AdminActionPlanShell({
  initialFilters,
  initialViewMode,
}: Props = {}) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<AdminPlanFiltersState>(() => {
    const url = parseAdminListUrlFilters(
      new URLSearchParams(searchParams.toString()),
    );
    return {
      ...initialAdminPlanFilters,
      ...(initialFilters ?? {}),
      ...(url.search !== undefined ? { search: url.search } : {}),
      ...(url.organizationId !== undefined
        ? { organizationId: url.organizationId }
        : {}),
      ...(url.formId !== undefined ? { formId: url.formId } : {}),
      ...(url.cycleId !== undefined ? { cycleId: url.cycleId } : {}),
      ...(url.from !== undefined ? { from: url.from } : {}),
      ...(url.to !== undefined ? { to: url.to } : {}),
      view: (url.status ?? initialFilters?.view ?? "") as AdminPlanFiltersState["view"],
    };
  });

  const controls = useAdminMonitoringListControls({
    allowedCardFilters: PLAN_CARD_FILTERS,
    initialLayout: initialViewMode,
    urlFilters: {
      search: filters.search,
      organizationId: filters.organizationId,
      formId: filters.formId,
      cycleId: filters.cycleId,
      axisId: "",
      status: filters.view,
      from: filters.from,
      to: filters.to,
    },
    signatureParts: [
      filters.organizationId,
      filters.formId,
      filters.cycleId,
      filters.view,
      filters.from,
      filters.to,
    ],
  });

  const query = useMemo<AdminActionPlanMonitoringQuery>(
    () => ({
      organizationId: filters.organizationId || undefined,
      formId: filters.formId || undefined,
      cycleId: filters.cycleId || undefined,
      view: filters.view || undefined,
      search: controls.searchDebounced || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      cardFilter: controls.cardFilter,
      layout: controls.viewMode,
      page: controls.page,
      pageSize: PAGE_SIZE,
    }),
    [filters, controls.searchDebounced, controls.cardFilter, controls.viewMode, controls.page],
  );

  const { data, filterOptions, loading, error, refetch } =
    useAdminActionPlans(query);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const exportData = useCallback(() => exportAdminActionPlans(query, "xlsx"), [query]);
  const presentation = useAdminMonitoringPresentation({
    filters,
    setFilters,
    resetFilters: initialAdminPlanFilters,
    filterOptions,
    items,
    total,
    selectedCycleLabel: data?.selectedCycleLabel,
    cardFilter: controls.cardFilter,
    setCardFilter: controls.setCardFilter,
    viewMode: controls.viewMode,
    refetch,
    exportData,
    actionMessages: {
      refreshSuccess: "Painel atualizado.",
      emptyExport: "Nenhuma ação coincide com os filtros ativos para exportação.",
      exportError: "Falha ao exportar ações.",
    },
    additionalActiveValues: [filters.view],
  });

  if (loading && !data) return <TableSkeleton rows={6} cols={4} />;
  if (error && !data) {
    return (
      <AsyncErrorState
        title="Não foi possível carregar o plano de integridade e compliance"
        message={error}
        onRetry={refetch}
        retrying={loading}
      />
    );
  }
  if (!data) return null;

  const emptyKind = controls.cardFilter === "overdue" ? "no-overdue" : "no-results";
  const content = data.total === 0
    ? presentation.activeFilters
      ? (
          <AdminActionPlanEmptyState
            kind={emptyKind}
            onClear={
              emptyKind === "no-results" ? presentation.clearFilters : undefined
            }
          />
        )
      : <AdminActionPlanEmptyState kind="none" />
    : controls.viewMode === "list"
      ? <AdminActionPlanList items={items} />
      : (
          <AdminActionPlanOrganizationView
            items={items}
            paginationResetKey={controls.filterSignature}
            serverPaginated
          />
        );

  const resultLabel =
    controls.viewMode === "organization"
      ? { singular: "organização", plural: "organizações" }
      : { singular: "ação", plural: "ações" };

  return (
    <AdminMonitoringWorkspace
      hero={
        <AdminActionPlanHero
          loading={loading}
          onRefresh={() => void presentation.actions.refresh()}
          catalogHref={adminBimonthlyReportsPath({
            organizationId: filters.organizationId || undefined,
            cycleId: filters.cycleId || undefined,
          })}
        />
      }
      error={error}
      loading={loading}
      onRetry={refetch}
      indicators={
        <AdminActionPlanSummaryCards
          summary={data.summary}
          activeFilter={controls.cardFilter}
          onSelect={(next) =>
            controls.setCardFilter(controls.cardFilter === next ? null : next)
          }
        />
      }
      filters={
        <AdminActionPlanFilters
          value={filters}
          organizations={presentation.options.organizations}
          forms={presentation.options.forms}
          onChange={setFilters}
        />
      }
      filtersDescription="Refine por organização, formulário, situação ou prazo."
      resultsDescription="Acompanhe os planos por eixo e seção. Abra a seção para a árvore de problemas e soluções e o consolidado das ações."
      total={data.total}
      summaryTotal={data.summary.total}
      hasCardFilter={Boolean(controls.cardFilter)}
      scopeParts={presentation.scopeParts}
      viewSwitcher={
        <AdminMonitoringViewSwitcher
          value={controls.viewMode}
          onChange={controls.setViewMode}
        />
      }
      content={content}
      page={data.page}
      pageSize={data.pageSize}
      paginationTotal={data.paginationTotal}
      totalPages={data.totalPages}
      pageItemCount={presentation.pageItemCount}
      onPageChange={controls.setPage}
      resultLabel={resultLabel}
      paginationAriaLabel={
        controls.viewMode === "organization"
          ? "Paginação por organização"
          : "Paginação de ações"
      }
    />
  );
}
