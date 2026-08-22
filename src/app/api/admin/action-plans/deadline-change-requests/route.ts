import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import {
  decideActionPlanDeadlineChange,
  listActionPlanDeadlineChangeRequests,
} from "@/features/improvement-management/action-plans/deadline-change-service";

const ROUTE = "/api/admin/action-plans/deadline-change-requests";

export const GET = withRoute(
  { roles: ["admin"], route: ROUTE, logMessage: "Failed to list admin deadline change requests" },
  async ({ request, auth }) => {
    const url = new URL(request.url);
    const page = await listActionPlanDeadlineChangeRequests(
      createSupabaseServiceRoleClient(),
      {
        recommendationId: url.searchParams.get("recommendationId") ?? undefined,
        planId: url.searchParams.get("planId") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
        limit: url.searchParams.get("limit") ?? undefined,
        offset: url.searchParams.get("offset") ?? undefined,
      },
      { role: "admin", organizationId: auth.organizationId },
    );
    return NextResponse.json(page);
  },
);

export const PATCH = withRoute(
  { roles: ["admin"], route: ROUTE, logMessage: "Failed to decide action plan deadline change" },
  async ({ request, auth }) => {
    const deadlineChange = await decideActionPlanDeadlineChange(
      createSupabaseServiceRoleClient(),
      await request.json(),
      auth.userId,
    );
    return NextResponse.json({ deadlineChange });
  },
);
