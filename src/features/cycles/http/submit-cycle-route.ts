import { NextResponse } from "next/server";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { resolveAuthorizedCycleScope } from "@/features/cycles/authorized-cycle";
import { submitCycle } from "@/features/cycles/submit-cycle-service";

export const POST = withRoute<{ cycleId: string }>(
  {
    roles: ["respondent"],
    route: "/api/respondent/cycles/[cycleId]/submit",
    logMessage: "Failed to submit cycle",
    internalErrorMessage: "Não foi possível enviar o diagnóstico para validação.",
  },
  async ({ auth, params }) => {
    const cycleId = requireUuid(params.cycleId, "cycleId");
    const supabase = createSupabaseServiceRoleClient();
    const authorized = await resolveAuthorizedCycleScope(supabase, auth, cycleId);
    if (authorized.error) return authorized.error;

    const result = await submitCycle(supabase, cycleId, auth.userId);
    return NextResponse.json(result);
  },
);
