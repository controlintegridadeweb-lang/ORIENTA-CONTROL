import { buildHeaders, formatError, parseJson } from "@/infrastructure/api/fetch-client";
import { recommendationFilterResponseSchema } from "@/features/improvement-management/client-contracts";
import type { RecommendationFilterOptions } from "./filter-options";
import type { RecommendationStatus } from "./schemas";

export type { RecommendationFilterOptions };

export type ListRecommendationsFilters = {
  cycleId?: string;
  formId?: string;
  organizationId?: string;
  axisId?: string;
  recommendationId?: string;
  status?: RecommendationStatus;
  type?: string;
  limit?: number;
  offset?: number;
};

export async function loadRecommendationFilters(): Promise<RecommendationFilterOptions> {
  const res = await fetch("/api/recommendations/filters", {
    headers: buildHeaders(),
    credentials: "include",
  });
  const body = await parseJson(res, recommendationFilterResponseSchema);
  if (!res.ok || !Array.isArray(body.forms)) throw new Error(formatError(body));
  return body;
}
