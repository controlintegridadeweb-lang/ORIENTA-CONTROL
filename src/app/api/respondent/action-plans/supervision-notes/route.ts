import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { ensureRecommendationAccess } from "@/infrastructure/api/tenant-guard";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import {
  listSupervisionNotes,
  respondToSupervisionRequest,
} from "@/features/improvement-management/action-plans/supervision-notes-service";

const ROUTE = "/api/respondent/action-plans/supervision-notes";

export const GET = withRoute(
  {
    roles: ["respondent"],
    route: ROUTE,
    logMessage: "Failed to list respondent supervision notes",
  },
  async ({ request, auth }) => {
    const url = new URL(request.url);
    const recommendationId = url.searchParams.get("recommendationId") ?? undefined;
    if (recommendationId) {
      const denied = await ensureRecommendationAccess(auth, recommendationId);
      if (denied) return denied;
    }

    const page = await listSupervisionNotes(
      createSupabaseServiceRoleClient(),
      {
        recommendationId,
        actionPlanId: url.searchParams.get("actionPlanId") ?? undefined,
        lifecycleStatuses: url.searchParams.getAll("lifecycleStatus"),
        limit: url.searchParams.get("limit") ?? undefined,
        offset: url.searchParams.get("offset") ?? undefined,
      },
      { role: auth.role, organizationId: auth.organizationId },
    );
    return NextResponse.json(page);
  },
);


export const PATCH = withRoute(
  {
    roles: ["respondent"],
    route: ROUTE,
    logMessage: "Failed to acknowledge supervision request",
  },
  async ({ request, auth }) => {
    const body = await request.json();
    const note = await respondToSupervisionRequest(
      createSupabaseServiceRoleClient(),
      body,
      { role: auth.role, organizationId: auth.organizationId },
      auth.userId,
    );
    return NextResponse.json({ note });
  },
);
