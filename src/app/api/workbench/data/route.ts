import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import { resolveAuthorizedWorkbenchContext } from "@/features/workbench/authorized-context";
import { loadWorkbenchPayload } from "@/features/workbench/load-workbench-payload";

const querySchema = z.object({ cycleId: z.string().uuid() });

/** Carrega o workbench pelo ciclo canônico da operação. */
export const GET = withRoute(
  {
    roles: ["admin", "respondent"],
    route: "/api/workbench/data",
    logMessage: "Failed to load workbench data",
  },
  async ({ request, auth }) => {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({ cycleId: url.searchParams.get("cycleId") });
    if (!parsed.success) {
      return NextResponse.json({ error: "cycleId (UUID) é obrigatório." }, { status: 400 });
    }

    const access = await resolveAuthorizedWorkbenchContext(auth, parsed.data.cycleId);
    if (access.context === null) return access.error;

    const payload = await loadWorkbenchPayload(access.context.supabase, access.context.scope.cycle.id);
    return NextResponse.json(payload);
  },
);
