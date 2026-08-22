import { NextResponse } from "next/server";
import { ensureRecommendationAccess } from "@/infrastructure/api/tenant-guard";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { loadRecommendationActionPlanCompletionReadiness } from "@/features/improvement-management/action-plans/completion-readiness";

const ROUTE = "/api/admin/action-plans/recommendations/[recommendationId]/completion-readiness";

export const GET = withRoute<{ recommendationId: string }>(
  {
    roles: ["admin"],
    route: ROUTE,
    logMessage: "Failed to load action plan completion readiness",
  },
  async ({ auth, params }) => {
    const recommendationId = requireUuid(params.recommendationId, "recommendationId");
    const denied = await ensureRecommendationAccess(auth, recommendationId);
    if (denied) return denied;

    const readiness = await loadRecommendationActionPlanCompletionReadiness(
      createSupabaseServiceRoleClient(),
      recommendationId,
    );
    return NextResponse.json({ readiness });
  },
);
