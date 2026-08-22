import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import {
  markResponseAdminNotApplicable,
  resolveAuthorizedCycleScope,
  revertResponseAdminNotApplicable,
} from "@/features/cycles/server";

const schema = z.object({
  action: z.enum(["mark", "revert"]),
  justification: z.string().trim().min(1).max(2000),
  expectedAdminStatus: z.literal("not_applicable").nullable().optional(),
  expectedDecidedAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict();

export const POST = withRoute<{ cycleId: string; responseId: string }>(
  {
    roles: ["admin"],
    route: "/api/admin/cycles/[cycleId]/validation/admin-not-applicable/[responseId]",
    logMessage: "Failed to update admin applicability",
  },
  async ({ request, auth, params }) => {
    const cycleId = requireUuid(params.cycleId, "cycleId");
    const responseId = requireUuid(params.responseId, "responseId");
    const body = schema.parse(await request.json());
    const supabase = createSupabaseServiceRoleClient();
    const authorized = await resolveAuthorizedCycleScope(supabase, auth, cycleId);
    if (authorized.error) return authorized.error;

    const operation = body.action === "mark"
      ? markResponseAdminNotApplicable
      : revertResponseAdminNotApplicable;
    const result = await operation(supabase, cycleId, responseId, {
      justification: body.justification,
      expectedAdminStatus: body.expectedAdminStatus,
      expectedDecidedAt: body.expectedDecidedAt,
      actorUserId: auth.userId,
    });
    return NextResponse.json(result);
  },
);
