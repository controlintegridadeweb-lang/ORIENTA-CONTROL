import { NextResponse } from "next/server";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { RespondentActionPlanCommandService } from "@/features/improvement-management/action-plans/respondent-command-service";

const ROUTE = "/api/respondent/action-plans/[planId]";

export const DELETE = withRoute<{ planId: string }>(
  {
    roles: ["respondent"],
    route: ROUTE,
    logMessage: "Failed to delete respondent action plan",
  },
  async ({ auth, params, request }) => {
    if (!auth.organizationId) {
      return NextResponse.json(
        { error: "Usuário sem organização vinculada." },
        { status: 403 },
      );
    }

    const sp = new URL(request.url).searchParams;
    const result = await new RespondentActionPlanCommandService().delete(
      {
        planId: requireUuid(params.planId, "planId"),
        recommendationId: sp.get("recommendationId"),
        expectedRevision: Number(sp.get("expectedRevision")),
      },
      {
        userId: auth.userId,
        role: "respondent",
        organizationId: auth.organizationId,
      },
    );
    return NextResponse.json(result);
  },
);
