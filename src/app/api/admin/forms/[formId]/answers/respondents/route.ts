import { NextResponse } from "next/server";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { FormsAnswersService } from "@/features/forms/answers-service";
import {
  parseAnswersListFilters,
  parseRespondentListCursor,
  parseRespondentListLimit,
} from "@/features/forms/answers-http";

export const GET = withRoute<{ formId: string }>(
  { roles: ["admin"], route: "/api/admin/forms/[formId]/answers/respondents" },
  async ({ request, params }) => {
    const formId = requireUuid(params.formId, "formId");
    const searchParams = new URL(request.url).searchParams;
    const page = await new FormsAnswersService().listRespondents(formId, {
      ...parseAnswersListFilters(searchParams),
      cursor: parseRespondentListCursor(searchParams),
      limit: parseRespondentListLimit(searchParams),
    });
    return NextResponse.json({ page });
  },
);
