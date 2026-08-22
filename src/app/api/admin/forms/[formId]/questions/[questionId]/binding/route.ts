import { NextResponse } from "next/server";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { QuestionBindingService } from "@/features/library/server";

type Params = { formId: string; questionId: string };
const ROUTE = "/api/admin/forms/[formId]/questions/[questionId]/binding";

export const GET = withRoute<Params>(
  { roles: ["admin"], route: ROUTE, logMessage: "Failed to load question library binding" },
  async ({ params }) => {
    const formId = requireUuid(params.formId, "formId");
    const questionId = requireUuid(params.questionId, "questionId");
    const configuration = await new QuestionBindingService().getConfiguration(formId, questionId);
    return NextResponse.json({ configuration });
  },
);

export const PUT = withRoute<Params>(
  { roles: ["admin"], route: ROUTE, logMessage: "Failed to save question library binding" },
  async ({ request, auth, params }) => {
    const formId = requireUuid(params.formId, "formId");
    const questionId = requireUuid(params.questionId, "questionId");
    const configuration = await new QuestionBindingService().saveConfiguration(
      formId,
      questionId,
      await request.json(),
      { userId: auth.userId },
    );
    return NextResponse.json({ configuration });
  },
);
