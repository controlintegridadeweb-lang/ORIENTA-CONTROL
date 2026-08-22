import { NextResponse } from "next/server";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { FormsAnswersService } from "@/features/forms/answers-service";

export const GET = withRoute<{ formId: string }>(
  { roles: ["admin"], route: "/api/admin/forms/[formId]/answers/respondents/filters" },
  async ({ params }) => {
    const formId = requireUuid(params.formId, "formId");
    const options = await new FormsAnswersService().listFilterOptions(formId);
    return NextResponse.json({ options });
  },
);
