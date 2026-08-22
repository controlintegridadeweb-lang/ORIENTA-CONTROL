"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { RecommendationFilterOptions } from "@/features/improvement-management/recommendations/filter-options";
import { useAdminMonitoringActions } from "@/features/improvement-management/monitoring/hooks/use-admin-monitoring-actions";
import { useAdminMonitoringFilterOptions } from "@/features/improvement-management/monitoring/hooks/use-admin-monitoring-filter-options";
import { useAdminMonitoringScopeParts } from "@/features/improvement-management/monitoring/hooks/use-admin-monitoring-scope-parts";

export type AdminMonitoringBaseFilters = {
  search: string;
  organizationId: string;
  formId: string;
  cycleId: string;
  from: string;
  to: string;
};

type ActionMessages = {
  refreshSuccess: string;
  emptyExport: string;
  exportError: string;
};

type Params<
  TFilters extends AdminMonitoringBaseFilters,
  TItem extends { organizationId: string },
> = {
  filters: TFilters;
  setFilters: Dispatch<SetStateAction<TFilters>>;
  resetFilters: TFilters;
  filterOptions: RecommendationFilterOptions | null;
  items: readonly TItem[];
  total: number;
  selectedCycleLabel?: string | null;
  cardFilter: string | null;
  setCardFilter: (value: null) => void;
  viewMode: "list" | "organization";
  refetch: () => Promise<void>;
  exportData: () => Promise<void>;
  actionMessages: ActionMessages;
  additionalActiveValues?: readonly unknown[];
};

/**
 * Estado de apresentação comum às filas administrativas. Consultas, filtros
 * específicos e componentes de domínio permanecem nos respectivos shells.
 */
export function useAdminMonitoringPresentation<
  TFilters extends AdminMonitoringBaseFilters,
  TItem extends { organizationId: string },
>({
  filters,
  setFilters,
  resetFilters,
  filterOptions,
  items,
  total,
  selectedCycleLabel,
  cardFilter,
  setCardFilter,
  viewMode,
  refetch,
  exportData,
  actionMessages,
  additionalActiveValues = [],
}: Params<TFilters, TItem>) {
  const options = useAdminMonitoringFilterOptions(filterOptions);
  const scopeParts = useAdminMonitoringScopeParts({
    filters,
    setFilters,
    organizationOptions: options.organizations,
    formOptions: options.forms,
    selectedCycleLabel,
  });
  const actions = useAdminMonitoringActions({
    total,
    refetch,
    exportData,
    ...actionMessages,
  });

  const clearFilters = useCallback(() => {
    setFilters({ ...resetFilters });
    setCardFilter(null);
  }, [resetFilters, setCardFilter, setFilters]);

  const activeFilters = [
    filters.search,
    filters.organizationId,
    filters.formId,
    filters.cycleId,
    filters.from,
    filters.to,
    cardFilter,
    ...additionalActiveValues,
  ].some(Boolean);

  const pageItemCount =
    viewMode === "organization"
      ? new Set(items.map((item) => item.organizationId)).size
      : items.length;

  return {
    options,
    scopeParts,
    actions,
    clearFilters,
    activeFilters,
    pageItemCount,
  };
}
