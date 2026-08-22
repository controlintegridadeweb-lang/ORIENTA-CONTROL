import { NextResponse } from "next/server";
import { z } from "zod";
import { DomainValidationError } from "@/infrastructure/api/domain-errors";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { changeFormApplicationDeadlines } from "@/features/cycles/server";

const schema = z.object({
  periodLabel: z.string().trim().min(1).max(80),
  action: z.enum(["change_deadline", "extend_deadline", "early_close"]),
  scope: z.enum(["all", "selected", "overdue", "single"]),
  organizationIds: z.array(z.string().uuid()).max(5000).optional(),
  newDeadlineAt: z.string().datetime({ offset: true }).nullable().optional(),
  justification: z.string().trim().min(1).max(4000),
}).strict();

export const POST = withRoute<{ formId: string }>(
  { roles: ["admin"], route: "/api/admin/form-applications/[formId]/deadline", logMessage: "Failed to change form application deadline" },
  async ({ request, auth, params }) => {
    const formId = requireUuid(params.formId, "formId");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new DomainValidationError(parsed.error.issues.map((i: { path: PropertyKey[]; message: string }) => ({ path: i.path.join(".") || "_", message: i.message })));
    const result = await changeFormApplicationDeadlines(createSupabaseServiceRoleClient(), {
      formId,
      ...parsed.data,
      newDeadlineAt: parsed.data.newDeadlineAt ?? null,
      actorUserId: auth.userId,
    });
    return NextResponse.json({ result });
  },
);
