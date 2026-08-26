"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminMonitoringWorkspace } from "@/shared/ui/admin/admin-monitoring-workspace";
import { AdminMonitoringViewSwitcher } from "@/features/improvement-management/monitoring/components/admin-monitoring-view-switcher";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { TableSkeleton } from "@/shared/ui/components/loading";
import { exportAdminRecommendations } from "@/features/improvement-management/monitoring/client";
import type { AdminRecommendationMonitoringQuery } from "@/features/improvement-management/monitoring/types";
import type { RecommendationPortfolioExportFormat } from "@/features/improvement-management/recommendations/export/portfolio-export-types";
import { parseAdminListUrlFilters } from "@/shared/config/admin-list-url";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import { useAdminMonitoringListControls } from "@/features/improvement-management/monitoring/hooks/use-admin-monitoring-list-controls";
import { useAdminMonitoringPresentation } from "@/features/improvement-management/monitoring/hooks/use-admin-monitoring-presentation";
import { AdminRecommendationsHero } from "./admin-recommendations-hero";
import { AdminRecommendationEmptyState } from "./admin-recommendation-empty-state";
import {
  AdminRecommendationFilters,
  initialAdminFilters,
  type AdminFiltersState,
} from "./admin-recommendation-filters";
import { AdminRecommendationList } from "./admin-recommendation-list";
import { AdminRecommendationOrganizationView } from "./admin-recommendation-organization-view";
import { AdminRecommendationSummaryCards } from "./admin-recommendation-summary-cards";
import { useAdminRecommendations } from "./hooks/use-admin-recommendations";

type Props = {
  initialFilters?: Partial<AdminFiltersState>;
};

const PAGE_SIZE = 10;
const RECOMMENDATION_CARD_FILTERS = [
  "without_plan",
  "executing",
  "completed",
  "overdue",
] as const;

export function AdminRecommendationsShell({ initialFilters }: Props = {}) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<AdminFiltersState>(() => {
    const url = parseAdminListUrlFilters(
      new URLSearchParams(searchParams.toString()),
      { includeAxis: true },
    );
    return {
      ...initialAdminFilters,
      ...(initialFilters ?? {}),
      ...(url.search !== undefined ? { search: url.search } : {}),
      ...(url.organizationId !== undefined
        ? { organizationId: url.organizationId }
        : {}),
      ...(url.formId !== undefined ? { formId: url.formId } : {}),
      ...(url.cycleId !== undefined ? { cycleId: url.cycleId } : {}),
      ...(url.axisId !== undefined ? { axisId: url.axisId } : {}),
      ...(url.from !== undefined ? { from: url.from } : {}),
      ...(url.to !== undefined ? { to: url.to } : {}),
      status: (url.status ?? initialFilters?.status ?? "") as AdminFiltersState["status"],
    };
  });

  const controls = useAdminMonitoringListControls({
    allowedCardFilters: RECOMMENDATION_CARD_FILTERS,
    includeAxis: true,
    urlFilters: {
      search: filters.search,
      organizationId: filters.organizationId,
      formId: filters.formId,
      cycleId: filters.cycleId,
      axisId: filters.axisId,
      status: filters.status,
      from: filters.from,
      to: filters.to,
    },
    signatureParts: [
      filters.organizationId,
      filters.formId,
      filters.cycleId,
      filters.axisId,
      filters.status,
      filters.from,
      filters.to,
    ],
  });

  const query = useMemo<AdminRecommendationMonitoringQuery>(
    () => ({
      organizationId: filters.organizationId || undefined,
      formId: filters.formId || undefined,
      cycleId: filters.cycleId || undefined,
      axisId: filters.axisId || undefined,
      status: filters.status || undefined,
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
    useAdminRecommendations(query);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const exportData = useCallback(
    () => exportAdminRecommendations(query, "csv"),
    [query],
  );
  const handleExport = useCallback(
    async (format: RecommendationPortfolioExportFormat) => {
      if (total === 0) {
        notify.warning("Não há recomendações para exportar com os filtros atuais.");
        return;
      }
      await notify.promise(exportAdminRecommendations(query, format), {
        loading: `Gerando ${format.toUpperCase()}...`,
        success: "Exportação concluída.",
        error: (error) => describeError(error, "Falha ao exportar recomendações."),
      });
    },
    [query, total],
  );
  const presentation = useAdminMonitoringPresentation({
    filters,
    setFilters,
    resetFilters: initialAdminFilters,
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
      refreshSuccess: "Recomendações atualizadas.",
      emptyExport: "Não há recomendações para exportar com os filtros atuais.",
      exportError: "Falha ao exportar recomendações.",
    },
    additionalActiveValues: [filters.axisId, filters.status],
  });

  if (loading && !data) return <TableSkeleton rows={6} cols={4} />;
  if (error && !data) {
    return (
      <AsyncErrorState
        title="Não foi possível carregar as recomendações"
        message={error}
        onRetry={refetch}
        retrying={loading}
      />
    );
  }
  if (!data) return null;

  const content = data.total === 0
    ? presentation.activeFilters
      ? (
          <AdminRecommendationEmptyState
            kind="no-results"
            onClear={presentation.clearFilters}
          />
        )
      : <AdminRecommendationEmptyState kind="none" />
    : controls.viewMode === "list"
      ? <AdminRecommendationList items={items} />
      : (
          <AdminRecommendationOrganizationView
            items={items}
            paginationResetKey={controls.filterSignature}
            serverPaginated
          />
        );

  const resultLabel =
    controls.viewMode === "organization"
      ? { singular: "organização", plural: "organizações" }
      : { singular: "recomendação", plural: "recomendações" };

  return (
    <AdminMonitoringWorkspace
      hero={
        <AdminRecommendationsHero
          loading={loading}
          onRefresh={() => void presentation.actions.refresh()}
          onExport={handleExport}
        />
      }
      error={error}
      loading={loading}
      onRetry={refetch}
      indicators={
        <AdminRecommendationSummaryCards
          summary={data.summary}
          activeFilter={controls.cardFilter}
          onSelect={(next) =>
            controls.setCardFilter(controls.cardFilter === next ? null : next)
          }
        />
      }
      filters={
        <AdminRecommendationFilters
          value={filters}
          organizations={presentation.options.organizations}
          forms={presentation.options.forms}
          axes={presentation.options.axes}
          onChange={setFilters}
        />
      }
      filtersDescription="Refine por organização, formulário, eixo, situação, início ou final."
      resultsDescription="Apresentadas na mesma sequência do diagnóstico, por eixo, seção e recomendação."
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
          : "Paginação de recomendações"
      }
    />
  );
}
