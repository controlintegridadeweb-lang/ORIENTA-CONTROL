import { NextResponse } from "next/server";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { resolveAuthorizedCycleScope } from "@/features/cycles/server";
import { dispatchEvidenceAdjustments } from "@/features/validation/evidence-adjustment-dispatch-service";

export const POST = withRoute<{ cycleId: string }>(
  {
    roles: ["admin"],
    route: "/api/admin/cycles/[cycleId]/validation/adjustments/dispatch",
    logMessage: "Failed to dispatch evidence adjustments",
  },
  async ({ auth, params }) => {
    const cycleId = requireUuid(params.cycleId, "cycleId");
    const supabase = createSupabaseServiceRoleClient();
    const authorized = await resolveAuthorizedCycleScope(supabase, auth, cycleId);
    if (authorized.error) return authorized.error;

    const result = await dispatchEvidenceAdjustments(supabase, cycleId, auth.userId);
    return NextResponse.json(result);
  },
);
