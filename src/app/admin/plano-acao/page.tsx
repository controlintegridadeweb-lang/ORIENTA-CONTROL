import { redirect } from "next/navigation";
import { AdminActionPlanShell } from "@/features/improvement-management/action-plans/components/admin/admin-action-plan-shell";
import type { AdminPlanFiltersState } from "@/features/improvement-management/action-plans/components/admin/admin-action-plan-filters";
import type { AdminMonitoringViewMode } from "@/features/improvement-management/monitoring/components/admin-monitoring-view-switcher";
import { firstSearchParam } from "@/features/admin/search-params";
import { queryPath } from "@/shared/navigation/query-path";
import {
  isInvalidUuidParam,
  parseUuidParam,
  uuidParamOrEmpty,
} from "@/shared/validation/uuid";

const VALID_VIEW_MODES: AdminMonitoringViewMode[] = ["list", "organization"];

function isValidViewMode(value: string | undefined): value is AdminMonitoringViewMode {
  return value != null && VALID_VIEW_MODES.includes(value as AdminMonitoringViewMode);
}

export default async function AdminPlanoAcaoPage({
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
  };
  const layout =
    firstSearchParam(sp, "layout") ??
    (firstSearchParam(sp, "view") === "organization" ? "organization" : undefined);
  const initialViewMode = isValidViewMode(layout) ? layout : undefined;
  const initialFilters: Partial<AdminPlanFiltersState> = {
    organizationId: uuidParamOrEmpty(rawFilters.organizationId),
    formId: uuidParamOrEmpty(rawFilters.formId),
    cycleId: uuidParamOrEmpty(rawFilters.cycleId),
  };

  if (recommendationId) {
    redirect(`/admin/plano-acao/${encodeURIComponent(recommendationId)}/visao-geral`);
  }

  const hasInvalidIdentifier =
    isInvalidUuidParam(rawRecommendationId) ||
    Object.values(rawFilters).some(isInvalidUuidParam);

  if (hasInvalidIdentifier) {
    redirect(
      queryPath("/admin/plano-acao", {
        ...initialFilters,
        layout: initialViewMode,
      }),
    );
  }

  return (
    <AdminActionPlanShell initialFilters={initialFilters} initialViewMode={initialViewMode} />
  );
}
