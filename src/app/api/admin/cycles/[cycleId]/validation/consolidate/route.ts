import { NextResponse } from "next/server";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { CycleStateService } from "@/features/cycles/cycle-state-service";
import { resolveAuthorizedCycleScope } from "@/features/cycles/authorized-cycle";

export const POST = withRoute<{ cycleId: string }>(
  {
    roles: ["admin"],
    route: "/api/admin/cycles/[cycleId]/validation/consolidate",
    logMessage: "Failed to consolidate cycle validation",
    internalErrorMessage: "Não foi possível concluir a validação e calcular o FAMI.",
  },
  async ({ auth, params }) => {
    const cycleId = requireUuid(params.cycleId, "cycleId");
    const supabase = createSupabaseServiceRoleClient();
    const authorized = await resolveAuthorizedCycleScope(supabase, auth, cycleId);
    if (authorized.error) return authorized.error;

    const service = new CycleStateService(supabase);
    const cycle = await service.require(cycleId);
    const updated = await service.consolidateValidation(cycle, auth.userId);

    return NextResponse.json({
      cycle: {
        id: updated.id,
        from: cycle.state,
        to: updated.state,
      },
    });
  },
);
