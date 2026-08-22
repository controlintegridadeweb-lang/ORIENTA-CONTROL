import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { ActionPlansQueryService } from "@/features/improvement-management/action-plans/query-service";
import { RespondentActionPlanCommandService } from "@/features/improvement-management/action-plans/respondent-command-service";
import { listActionPlansQuerySchema } from "@/features/improvement-management/action-plans/schemas";

const ROUTE = "/api/respondent/action-plans";

export const GET = withRoute(
  { roles: ["respondent"], route: ROUTE, logMessage: "Failed to list respondent action plans" },
  async ({ request, auth }) => {
    if (!auth.organizationId) {
      return NextResponse.json({ error: "Usuário sem organização vinculada." }, { status: 403 });
    }
    const sp = new URL(request.url).searchParams;
    const raw = {
      cycleId: sp.get("cycleId") ?? undefined,
      formId: sp.get("formId") ?? undefined,
      view: sp.get("view") ?? undefined,
      recommendationStatus: sp.get("recommendationStatus") ?? undefined,
      planStatus: sp.get("planStatus") ?? undefined,
      responsibleContains: sp.get("responsibleContains") ?? undefined,
      search: sp.get("search") ?? undefined,
      dueFilter: sp.get("dueFilter") ?? undefined,
      limit: sp.get("limit") ?? undefined,
      offset: sp.get("offset") ?? undefined,
    };
    const query = listActionPlansQuerySchema.parse(raw);
    const result = await new ActionPlansQueryService().list(query, {
      role: "respondent",
      organizationId: auth.organizationId,
    });
    return NextResponse.json(result);
  },
);

export const POST = withRoute(
  { roles: ["respondent"], route: ROUTE, logMessage: "Failed to save respondent action plan" },
  async ({ request, auth }) => {
    if (!auth.organizationId) {
      return NextResponse.json({ error: "Usuário sem organização vinculada." }, { status: 403 });
    }
    const body = await request.json();
    const result = await new RespondentActionPlanCommandService().save(body, {
      userId: auth.userId,
      role: "respondent",
      organizationId: auth.organizationId,
    });
    return NextResponse.json(result);
  },
);
