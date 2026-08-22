import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { ensureRecommendationAccess } from "@/infrastructure/api/tenant-guard";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import {
  createSupervisionNote,
  decideSupervisionRequest,
  listSupervisionNotes,
} from "@/features/improvement-management/action-plans/supervision-notes-service";

const ROUTE = "/api/admin/action-plans/supervision-notes";

export const GET = withRoute(
  { roles: ["admin"], route: ROUTE, logMessage: "Failed to list supervision notes" },
  async ({ request, auth }) => {
    const url = new URL(request.url);
    const recommendationId = url.searchParams.get("recommendationId") ?? undefined;
    const tenantError = recommendationId
      ? await ensureRecommendationAccess(auth, recommendationId)
      : null;
    if (tenantError) return tenantError;

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

export const POST = withRoute(
  { roles: ["admin"], route: ROUTE, logMessage: "Failed to create supervision note" },
  async ({ request, auth }) => {
    const body = await request.json();
    const recommendationId =
      typeof body?.recommendationId === "string" ? body.recommendationId : undefined;
    const tenantError = recommendationId
      ? await ensureRecommendationAccess(auth, recommendationId)
      : null;
    if (tenantError) return tenantError;

    const note = await createSupervisionNote(
      createSupabaseServiceRoleClient(),
      body,
      { role: auth.role, organizationId: auth.organizationId },
      auth.userId,
    );
    return NextResponse.json({ note }, { status: 201 });
  },
);


export const PATCH = withRoute(
  { roles: ["admin"], route: ROUTE, logMessage: "Failed to decide supervision request" },
  async ({ request, auth }) => {
    const body = await request.json();
    const note = await decideSupervisionRequest(
      createSupabaseServiceRoleClient(),
      body,
      { role: auth.role, organizationId: auth.organizationId },
      auth.userId,
    );
    return NextResponse.json({ note });
  },
);
