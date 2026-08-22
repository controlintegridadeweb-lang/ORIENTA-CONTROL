import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { ActionPlansQueryService } from "@/features/improvement-management/action-plans/query-service";

export const GET = withRoute(
  { roles: ["admin"], route: "/api/admin/action-plans", logMessage: "Failed to list action plans" },
  async ({ request, auth }) => {
    const sp = new URL(request.url).searchParams;
    const raw = {
      cycleId: sp.get("cycleId") ?? undefined,
      formId: sp.get("formId") ?? undefined,
      organizationId: sp.get("organizationId") ?? undefined,
      recommendationId: sp.get("recommendationId") ?? undefined,
      view: sp.get("view") ?? undefined,
      recommendationStatus: sp.get("recommendationStatus") ?? undefined,
      planStatus: sp.get("planStatus") ?? undefined,
      responsibleContains: sp.get("responsibleContains") ?? undefined,
      search: sp.get("search") ?? undefined,
      dueFilter: sp.get("dueFilter") ?? undefined,
      limit: sp.get("limit") ?? undefined,
      offset: sp.get("offset") ?? undefined,
    };
    const result = await new ActionPlansQueryService().list(raw, {
      role: auth.role,
      organizationId: auth.organizationId,
    });
    return NextResponse.json(result);
  },
);
