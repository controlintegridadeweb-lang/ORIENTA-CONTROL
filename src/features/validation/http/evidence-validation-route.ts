import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { resolveAuthorizedCycleScope, validateEvidence } from "@/features/cycles/server";

const schema = z.object({
  action: z.enum(["approve", "invalidate", "request_adjustment"]),
  justification: z.string().trim().max(2000).nullable().optional(),
  expectedStatus: z.enum(["pending", "approved", "invalidated", "adjustment_requested"]),
  expectedValidatedAt: z.string().datetime({ offset: true }).nullable(),
}).strict();

export const POST = withRoute<{ cycleId: string; evidenceId: string }>(
  {
    roles: ["admin"],
    route: "/api/admin/cycles/[cycleId]/validation/evidences/[evidenceId]",
    logMessage: "Failed to validate evidence",
  },
  async ({ request, auth, params }) => {
    const cycleId = requireUuid(params.cycleId, "cycleId");
    const evidenceId = requireUuid(params.evidenceId, "evidenceId");
    const body = schema.parse(await request.json());
    const supabase = createSupabaseServiceRoleClient();
    const authorized = await resolveAuthorizedCycleScope(supabase, auth, cycleId);
    if (authorized.error) return authorized.error;

    const result = await validateEvidence(supabase, cycleId, evidenceId, {
      ...body,
      actorUserId: auth.userId,
    });
    return NextResponse.json(result);
  },
);
