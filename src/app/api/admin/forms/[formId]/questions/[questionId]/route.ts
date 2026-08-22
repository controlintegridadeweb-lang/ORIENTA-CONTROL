import { NextResponse } from "next/server";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { FormsAdminService } from "@/features/forms/server";

const ROUTE = "/api/admin/forms/[formId]/questions/[questionId]";

type Params = { formId: string; questionId: string };

export const PATCH = withRoute<Params>(
  { roles: ["admin"], route: ROUTE, logMessage: "Failed to update form question" },
  async ({ request, params }) => {
    const formId = requireUuid(params.formId, "formId");
    const questionId = requireUuid(params.questionId, "questionId");
    const question = await new FormsAdminService().updateQuestion(formId, questionId, await request.json());
    return NextResponse.json({ question });
  },
);

export const DELETE = withRoute<Params>(
  { roles: ["admin"], route: ROUTE, logMessage: "Failed to delete form question" },
  async ({ auth, params }) => {
    const formId = requireUuid(params.formId, "formId");
    const questionId = requireUuid(params.questionId, "questionId");
    await new FormsAdminService().removeQuestion(formId, questionId, { userId: auth.userId });
    return NextResponse.json({ ok: true });
  },
);
