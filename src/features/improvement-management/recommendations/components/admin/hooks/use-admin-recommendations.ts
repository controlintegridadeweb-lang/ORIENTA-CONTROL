"use client";

import { useCallback } from "react";
import { listAdminRecommendationMonitoring } from "@/features/improvement-management/monitoring/client";
import type {
  AdminRecommendationMonitoringQuery,
  AdminRecommendationMonitoringResult,
} from "@/features/improvement-management/monitoring/types";
import { useAdminMonitoringRequest } from "@/features/improvement-management/monitoring/hooks/use-admin-monitoring-request";
import { useRecommendationFilterOptions } from "@/features/improvement-management/monitoring/hooks/use-recommendation-filter-options";
import type { RecommendationFilterOptions } from "@/features/improvement-management/recommendations/filter-options";

export type UseAdminRecommendationsResult = {
  data: AdminRecommendationMonitoringResult | null;
  filterOptions: RecommendationFilterOptions | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useAdminRecommendations(
  query: AdminRecommendationMonitoringQuery,
): UseAdminRecommendationsResult {
  const request = useCallback(
    (signal: AbortSignal) => listAdminRecommendationMonitoring(query, signal),
    [query],
  );
  const state = useAdminMonitoringRequest(request, "Falha ao carregar recomendações.");
  const filterOptions = useRecommendationFilterOptions();
  return { ...state, filterOptions };
}
