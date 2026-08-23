import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { logError } from "@/infrastructure/observability/logger";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { resolveAuthorizedCycleScope, validateNotApplicableResponse } from "@/features/cycles/server";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().trim().max(2000).nullable().optional(),
  expectedStatus: z.enum(["pending", "approved", "rejected"]),
  expectedValidatedAt: z.string().datetime({ offset: true }).nullable(),
}).strict();

export const POST = withRoute<{ cycleId: string; responseId: string }>(
  {
    roles: ["admin"],
    route: "/api/admin/cycles/[cycleId]/validation/not-applicable/[responseId]",
    logMessage: "Failed to validate not-applicable response",
  },
  async ({ request, auth, params }) => {
    const cycleId = requireUuid(params.cycleId, "cycleId");
    const responseId = requireUuid(params.responseId, "responseId");
    const body = schema.parse(await request.json());
    const supabase = createSupabaseServiceRoleClient();
    let authorized;
    try {
      authorized = await resolveAuthorizedCycleScope(supabase, auth, cycleId);
    } catch (error) {
      logError("Failed to validate not-applicable response", error, {
        route: "/api/admin/cycles/[cycleId]/validation/not-applicable/[responseId]",
        phase: "cycle_scope",
      });
      throw error;
    }
    if (authorized.error) return authorized.error;

    try {
      const result = await validateNotApplicableResponse(supabase, cycleId, responseId, {
        ...body,
        actorUserId: auth.userId,
      });
      return NextResponse.json(result);
    } catch (error) {
      logError("Failed to validate not-applicable response", error, {
        route: "/api/admin/cycles/[cycleId]/validation/not-applicable/[responseId]",
        phase: "validate_rpc",
      });
      throw error;
    }
  },
);
