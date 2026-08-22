import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { listActionPlanResponsibleMembers } from "@/features/improvement-management/action-plans/responsible-members";

const ROUTE = "/api/respondent/action-plans/responsibles";

export const GET = withRoute(
  {
    roles: ["respondent"],
    route: ROUTE,
    logMessage: "Failed to list action plan responsible members",
  },
  async ({ auth }) => {
    if (!auth.organizationId) {
      return NextResponse.json(
        { error: "Usuário sem organização vinculada." },
        { status: 403 },
      );
    }

    const items = await listActionPlanResponsibleMembers(auth.organizationId);
    return NextResponse.json({ items });
  },
);
