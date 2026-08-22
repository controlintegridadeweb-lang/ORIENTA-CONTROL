import { NextResponse } from "next/server";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { resolveAuthorizedCycleScope } from "@/features/cycles/authorized-cycle";
import { getValidationReopenImpact } from "@/features/cycles/validation-reopen-impact";

export const GET = withRoute<{ cycleId: string }>(
  {
    roles: ["admin"],
    route: "/api/admin/cycles/[cycleId]/validation-reopen-impact",
    internalErrorMessage: "Não foi possível verificar o impacto da reabertura.",
  },
  async ({ auth, params }) => {
    const cycleId = requireUuid(params.cycleId, "cycleId");
    const supabase = createSupabaseServiceRoleClient();
    const authorized = await resolveAuthorizedCycleScope(supabase, auth, cycleId);
    if (authorized.error) return authorized.error;

    const impact = await getValidationReopenImpact(supabase, cycleId);
    return NextResponse.json(
      { impact },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  },
);
