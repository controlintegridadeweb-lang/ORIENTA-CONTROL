"use client";

import { useCallback } from "react";
import {
  listAdminActionPlanMonitoring,
} from "@/features/improvement-management/monitoring/client";
import type {
  AdminActionPlanMonitoringQuery,
  AdminActionPlanMonitoringResult,
} from "@/features/improvement-management/monitoring/types";
import { useAdminMonitoringRequest } from "@/features/improvement-management/monitoring/hooks/use-admin-monitoring-request";
import { useRecommendationFilterOptions } from "@/features/improvement-management/monitoring/hooks/use-recommendation-filter-options";
import type { RecommendationFilterOptions } from "@/features/improvement-management/recommendations/filter-options";

export type UseAdminActionPlansResult = {
  data: AdminActionPlanMonitoringResult | null;
  filterOptions: RecommendationFilterOptions | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useAdminActionPlans(
  query: AdminActionPlanMonitoringQuery,
): UseAdminActionPlansResult {
  const request = useCallback(
    (signal: AbortSignal) => listAdminActionPlanMonitoring(query, signal),
    [query],
  );
  const state = useAdminMonitoringRequest(request, "Falha ao carregar planos de ação.");
  const filterOptions = useRecommendationFilterOptions();
  return { ...state, filterOptions };
}
