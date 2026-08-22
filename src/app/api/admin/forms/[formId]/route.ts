import { NextResponse } from "next/server";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { FormsAdminService } from "@/features/forms/server";

const ROUTE = "/api/admin/forms/[formId]";

export const GET = withRoute<{ formId: string }>(
  { roles: ["admin"], route: ROUTE, logMessage: "Failed to load form" },
  async ({ params }) => {
    const formId = requireUuid(params.formId, "formId");
    const form = await new FormsAdminService().getById(formId);
    return NextResponse.json({ form });
  },
);

export const PATCH = withRoute<{ formId: string }>(
  { roles: ["admin"], route: ROUTE, logMessage: "Failed to rename form" },
  async ({ request, params }) => {
    const formId = requireUuid(params.formId, "formId");
    const form = await new FormsAdminService().rename(formId, await request.json());
    return NextResponse.json({ form });
  },
);

export const DELETE = withRoute<{ formId: string }>(
  { roles: ["admin"], route: ROUTE, logMessage: "Failed to delete form" },
  async ({ auth, params }) => {
    const formId = requireUuid(params.formId, "formId");
    await new FormsAdminService().deleteForm(formId, { userId: auth.userId });
    return NextResponse.json({ ok: true });
  },
);
