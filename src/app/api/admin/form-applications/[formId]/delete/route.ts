import { NextResponse } from "next/server";
import { z } from "zod";
import { DomainValidationError } from "@/infrastructure/api/domain-errors";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { deleteSuspendedForm } from "@/features/cycles/server";

const schema = z.object({
  justification: z.string().trim().min(1).max(4000),
}).strict();

export const POST = withRoute<{ formId: string }>(
  {
    roles: ["admin"],
    route: "/api/admin/form-applications/[formId]/delete",
    logMessage: "Failed to delete suspended form",
  },
  async ({ request, auth, params }) => {
    const formId = requireUuid(params.formId, "formId");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new DomainValidationError(
        parsed.error.issues.map((issue: { path: PropertyKey[]; message: string }) => ({
          path: issue.path.join(".") || "_",
          message: issue.message,
        })),
      );
    }
    const result = await deleteSuspendedForm(createSupabaseServiceRoleClient(), {
      formId,
      justification: parsed.data.justification,
      actorUserId: auth.userId,
    });
    return NextResponse.json({ result });
  },
);
