import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { resolveAuthorizedCycleScope } from "@/features/cycles/authorized-cycle";
import { setCycleReferencePeriod } from "@/features/cycles/reference-period-service";

const schema = z.object({
  referenceStartYear: z.number().int(),
  referenceEndYear: z.number().int(),
}).strict();

export const PATCH = withRoute<{ cycleId: string }>(
  {
    roles: ["admin"],
    route: "/api/admin/cycles/[cycleId]/reference-period",
    logMessage: "Failed to update cycle reference period",
    internalErrorMessage: "Não foi possível atualizar o período de referência.",
  },
  async ({ request, auth, params }) => {
    const cycleId = requireUuid(params.cycleId, "cycleId");
    const body = schema.parse(await request.json());
    const supabase = createSupabaseServiceRoleClient();
    const authorized = await resolveAuthorizedCycleScope(supabase, auth, cycleId);
    if (authorized.error) return authorized.error;

    const referencePeriod = await setCycleReferencePeriod(supabase, {
      cycleId,
      actorUserId: auth.userId,
      referenceStartYear: body.referenceStartYear,
      referenceEndYear: body.referenceEndYear,
    });
    return NextResponse.json({ referencePeriod });
  },
);
