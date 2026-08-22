import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { resolveAuthorizedWorkbenchContext } from "@/features/workbench/authorized-context";
import {
  saveWorkbenchResponseWithEvidence,
  workbenchResponseBodySchema,
} from "@/features/workbench/save-workbench-response";

/** Grava resposta e evidência pelo `cycleId` canônico. */
export const POST = withRoute(
  {
    roles: ["respondent"],
    route: "/api/workbench/response",
    logMessage: "Failed to save response",
  },
  async ({ request, auth }) => {
    const parsed = workbenchResponseBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const access = await resolveAuthorizedWorkbenchContext(auth, parsed.data.cycleId);
    if (access.context === null) return access.error;

    const result = await saveWorkbenchResponseWithEvidence(
      access.context.supabase,
      {
        userId: auth.userId,
        organizationId: access.context.scope.cycle.organizationId,
      },
      parsed.data,
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, fields: result.fields },
        { status: result.status },
      );
    }

    return NextResponse.json({
      response: result.response,
      evidenceCleanupPending: result.evidenceCleanupPending,
    });
  },
);
