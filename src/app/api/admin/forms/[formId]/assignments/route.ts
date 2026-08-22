import { NextResponse } from "next/server";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { FormAssignmentsService } from "@/features/forms/server";

const ROUTE = "/api/admin/forms/[formId]/assignments";

export const GET = withRoute<{ formId: string }>(
  { roles: ["admin"], route: ROUTE, logMessage: "Failed to load form assignments" },
  async ({ params }) => {
    const formId = requireUuid(params.formId, "formId");
    const service = new FormAssignmentsService();
    const [summary, organizations] = await Promise.all([
      service.getSummary(formId),
      service.listOrganizationOptions(formId),
    ]);
    return NextResponse.json({ summary, organizations });
  },
);

export const PUT = withRoute<{ formId: string }>(
  { roles: ["admin"], route: ROUTE, logMessage: "Failed to sync form assignments" },
  async ({ request, auth, params }) => {
    const formId = requireUuid(params.formId, "formId");
    const summary = await new FormAssignmentsService().syncAssignments(formId, await request.json(), { userId: auth.userId });
    return NextResponse.json({ summary });
  },
);
