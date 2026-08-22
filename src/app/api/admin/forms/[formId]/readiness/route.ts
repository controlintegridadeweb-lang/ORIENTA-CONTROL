import { NextResponse } from "next/server";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { FormsPublicationService } from "@/features/forms/server";

export const GET = withRoute<{ formId: string }>(
  { roles: ["admin"], route: "/api/admin/forms/[formId]/readiness", logMessage: "Failed to evaluate form readiness" },
  async ({ params }) => {
    const formId = requireUuid(params.formId, "formId");
    return NextResponse.json(await new FormsPublicationService().readiness(formId));
  },
);
