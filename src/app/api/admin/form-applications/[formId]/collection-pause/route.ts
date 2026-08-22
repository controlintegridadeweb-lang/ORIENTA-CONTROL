import { NextResponse } from "next/server";
import { z } from "zod";
import { DomainValidationError } from "@/infrastructure/api/domain-errors";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { setFormApplicationCollectionPause } from "@/features/cycles/server";

const schema = z.object({
  periodLabel: z.string().trim().min(1).max(80),
  pause: z.boolean(),
  scope: z.enum(["all", "selected", "overdue", "single"]).default("all"),
  organizationIds: z.array(z.string().uuid()).max(5000).optional(),
  justification: z.string().trim().min(1).max(4000),
}).strict();

export const POST = withRoute<{ formId: string }>(
  { roles: ["admin"], route: "/api/admin/form-applications/[formId]/collection-pause", logMessage: "Failed to update form collection pause" },
  async ({ request, auth, params }) => {
    const formId = requireUuid(params.formId, "formId");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new DomainValidationError(parsed.error.issues.map((i: { path: PropertyKey[]; message: string }) => ({ path: i.path.join(".") || "_", message: i.message })));
    const result = await setFormApplicationCollectionPause(createSupabaseServiceRoleClient(), {
      formId,
      ...parsed.data,
      actorUserId: auth.userId,
    });
    return NextResponse.json({ result });
  },
);
