import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import {
  listActionPlanDeadlineChangeRequests,
  requestActionPlanDeadlineChange,
} from "@/features/improvement-management/action-plans/deadline-change-service";

const ROUTE = "/api/respondent/action-plans/deadline-change-requests";

export const GET = withRoute(
  { roles: ["respondent"], route: ROUTE, logMessage: "Failed to list respondent deadline change requests" },
  async ({ request, auth }) => {
    if (!auth.organizationId) {
      return NextResponse.json({ error: "Usuário sem organização vinculada." }, { status: 403 });
    }
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
      { role: "respondent", organizationId: auth.organizationId },
    );
    return NextResponse.json(page);
  },
);

export const POST = withRoute(
  { roles: ["respondent"], route: ROUTE, logMessage: "Failed to request action plan deadline change" },
  async ({ request, auth }) => {
    if (!auth.organizationId) {
      return NextResponse.json({ error: "Usuário sem organização vinculada." }, { status: 403 });
    }
    const deadlineChange = await requestActionPlanDeadlineChange(
      createSupabaseServiceRoleClient(),
      await request.json(),
      { userId: auth.userId, organizationId: auth.organizationId },
    );
    return NextResponse.json({ deadlineChange }, { status: 201 });
  },
);
