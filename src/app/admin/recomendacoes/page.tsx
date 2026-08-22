import { redirect } from "next/navigation";
import { AdminRecommendationsShell } from "@/features/improvement-management/recommendations/components/admin/admin-recommendations-shell";
import { firstSearchParam } from "@/features/admin/search-params";
import type { AdminFiltersState } from "@/features/improvement-management/recommendations/components/admin/admin-recommendation-filters";
import { queryPath } from "@/shared/navigation/query-path";
import {
  isInvalidUuidParam,
  parseUuidParam,
  uuidParamOrEmpty,
} from "@/shared/validation/uuid";

export default async function AdminRecomendacoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawRecommendationId = firstSearchParam(sp, "recommendationId");
  const recommendationId = parseUuidParam(rawRecommendationId);
  const rawFilters = {
    organizationId: firstSearchParam(sp, "organizationId"),
    formId: firstSearchParam(sp, "formId"),
    cycleId: firstSearchParam(sp, "cycleId"),
    axisId: firstSearchParam(sp, "axisId"),
  };
  const initialFilters: Partial<AdminFiltersState> = {
    organizationId: uuidParamOrEmpty(rawFilters.organizationId),
    formId: uuidParamOrEmpty(rawFilters.formId),
    cycleId: uuidParamOrEmpty(rawFilters.cycleId),
    axisId: uuidParamOrEmpty(rawFilters.axisId),
  };

  if (recommendationId) {
    redirect(`/admin/recomendacoes/${encodeURIComponent(recommendationId)}/visao-geral`);
  }

  const hasInvalidIdentifier =
    isInvalidUuidParam(rawRecommendationId) ||
    Object.values(rawFilters).some(isInvalidUuidParam);

  if (hasInvalidIdentifier) {
    redirect(queryPath("/admin/recomendacoes", initialFilters));
  }

  return <AdminRecommendationsShell initialFilters={initialFilters} />;
}
