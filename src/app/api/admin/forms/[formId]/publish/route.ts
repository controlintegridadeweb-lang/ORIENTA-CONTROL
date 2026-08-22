import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { FormPublishPendingError, FormsPublicationService } from "@/features/forms/server";

const bodySchema = z.object({ action: z.literal("publish") }).strict();

export const POST = withRoute<{ formId: string }>(
  {
    roles: ["admin"],
    route: "/api/admin/forms/[formId]/publish",
    logMessage: "Failed to publish form",
    extraErrorHandlers: [
      (error) => error instanceof FormPublishPendingError
        ? NextResponse.json({ error: error.message, pending: error.pending }, { status: 409 })
        : null,
    ],
  },
  async ({ request, auth, params }) => {
    const formId = requireUuid(params.formId, "formId");
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const form = await new FormsPublicationService().publish(formId, { userId: auth.userId });
    return NextResponse.json({ form });
  },
);
