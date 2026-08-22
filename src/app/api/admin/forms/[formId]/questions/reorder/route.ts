import { NextResponse } from "next/server";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { FormsAdminService } from "@/features/forms/server";

export const PATCH = withRoute<{ formId: string }>(
  { roles: ["admin"], route: "/api/admin/forms/[formId]/questions/reorder", logMessage: "Failed to reorder form questions" },
  async ({ request, params }) => {
    const formId = requireUuid(params.formId, "formId");
    const questions = await new FormsAdminService().reorderQuestions(formId, await request.json());
    return NextResponse.json({ questions });
  },
);
