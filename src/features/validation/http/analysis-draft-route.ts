import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { resolveAuthorizedCycleScope } from "@/features/cycles/server";
import { saveValidationAnalysisDraft } from "@/features/validation/validation-analysis-draft-service";

const schema = z.object({
  targetKind: z.enum(["evidence", "not_applicable", "absent_proof", "admin_not_applicable"]),
  evidenceId: z.string().uuid().nullable().optional(),
  responseId: z.string().uuid().nullable().optional(),
  action: z.string().trim().max(100).nullable().optional(),
  justification: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  expectedRevision: z.number().int().positive().nullable().optional(),
}).strict();

export const POST = withRoute<{ cycleId: string }>(
  {
    roles: ["admin"],
    route: "/api/admin/cycles/[cycleId]/validation/analysis-draft",
    logMessage: "Failed to save validation analysis draft",
  },
  async ({ request, auth, params }) => {
    const cycleId = requireUuid(params.cycleId, "cycleId");
    const body = schema.parse(await request.json());
    const supabase = createSupabaseServiceRoleClient();
    const authorized = await resolveAuthorizedCycleScope(supabase, auth, cycleId);
    if (authorized.error) return authorized.error;

    const result = await saveValidationAnalysisDraft(supabase, cycleId, {
      ...body,
      actorUserId: auth.userId,
    });
    return NextResponse.json(result);
  },
);
