import { NextResponse } from "next/server";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { FormsAdminService } from "@/features/forms/server";

const ROUTE = "/api/admin/forms/[formId]/questions";

export const GET = withRoute<{ formId: string }>(
  { roles: ["admin"], route: ROUTE, logMessage: "Failed to list form questions" },
  async ({ params }) => {
    const formId = requireUuid(params.formId, "formId");
    return NextResponse.json({ questions: await new FormsAdminService().listQuestions(formId) });
  },
);

export const POST = withRoute<{ formId: string }>(
  { roles: ["admin"], route: ROUTE, logMessage: "Failed to create form question" },
  async ({ request, auth, params }) => {
    const formId = requireUuid(params.formId, "formId");
    const question = await new FormsAdminService().createQuestion(formId, await request.json(), { userId: auth.userId });
    return NextResponse.json({ question }, { status: 201 });
  },
);
