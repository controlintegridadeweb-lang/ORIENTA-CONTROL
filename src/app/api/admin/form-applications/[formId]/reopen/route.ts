import { NextResponse } from "next/server";
import { z } from "zod";
import { DomainValidationError } from "@/infrastructure/api/domain-errors";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { reopenFormApplicationResponses } from "@/features/cycles/server";

const schema = z.object({
  periodLabel: z.string().trim().min(1).max(80),
  scope: z.enum(["all", "selected", "overdue", "single"]),
  organizationIds: z.array(z.string().uuid()).max(5000).optional(),
  newDeadlineAt: z.string().datetime({ offset: true }),
  justification: z.string().trim().min(1).max(4000),
  reopenMode: z.enum(["full", "partial"]).default("full"),
  questionVersionIds: z.array(z.string().uuid()).max(5000).optional(),
}).strict();

export const POST = withRoute<{ formId: string }>(
  { roles: ["admin"], route: "/api/admin/form-applications/[formId]/reopen", logMessage: "Failed to reopen form application responses" },
  async ({ request, auth, params }) => {
    const formId = requireUuid(params.formId, "formId");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new DomainValidationError(parsed.error.issues.map((i: { path: PropertyKey[]; message: string }) => ({ path: i.path.join(".") || "_", message: i.message })));
    const result = await reopenFormApplicationResponses(createSupabaseServiceRoleClient(), {
      formId,
      ...parsed.data,
      actorUserId: auth.userId,
    });
    return NextResponse.json({ result });
  },
);
