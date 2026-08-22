import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { decideResponseWithoutProof, resolveAuthorizedCycleScope } from "@/features/cycles/server";
import { adminProofStatusSchema } from "@/shared/domain/admin-proof-status";

const schema = z.object({
  action: z.enum(["validate_without_proof", "request_proof", "consider_insufficient"]),
  observation: z.string().trim().min(1).max(2000),
  expectedStatus: adminProofStatusSchema.nullable().optional(),
  expectedDecidedAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict();

export const POST = withRoute<{ cycleId: string; responseId: string }>(
  {
    roles: ["admin"],
    route: "/api/admin/cycles/[cycleId]/validation/admin-proof-decision/[responseId]",
    logMessage: "Failed to record admin proof decision",
  },
  async ({ request, auth, params }) => {
    const cycleId = requireUuid(params.cycleId, "cycleId");
    const responseId = requireUuid(params.responseId, "responseId");
    const body = schema.parse(await request.json());
    const supabase = createSupabaseServiceRoleClient();
    const authorized = await resolveAuthorizedCycleScope(supabase, auth, cycleId);
    if (authorized.error) return authorized.error;

    const result = await decideResponseWithoutProof(supabase, cycleId, responseId, {
      ...body,
      actorUserId: auth.userId,
    });
    return NextResponse.json(result);
  },
);
