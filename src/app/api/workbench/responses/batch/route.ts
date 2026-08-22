import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import { mapConcurrent } from "@/shared/async/map-concurrent";
import { resolveAuthorizedWorkbenchContext } from "@/features/workbench/authorized-context";
import {
  saveWorkbenchResponseWithEvidence,
  workbenchResponseItemSchema,
} from "@/features/workbench/save-workbench-response";

const bodySchema = z.object({
  cycleId: z.string().uuid(),
  responses: z.array(workbenchResponseItemSchema).min(1).max(200),
}).strict();

export const POST = withRoute(
  {
    roles: ["respondent"],
    route: "/api/workbench/responses/batch",
    logMessage: "Failed to save workbench response batch",
  },
  async ({ request, auth }) => {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const access = await resolveAuthorizedWorkbenchContext(auth, parsed.data.cycleId);
    if (access.context === null) return access.error;

    const uniqueResponses = Array.from(
      new Map(parsed.data.responses.map((response) => [response.questionId, response])).values(),
    );
    const results = await mapConcurrent(uniqueResponses, 3, async (response) => {
      try {
        const result = await saveWorkbenchResponseWithEvidence(
          access.context.supabase,
          {
            userId: auth.userId,
            organizationId: access.context.scope.cycle.organizationId,
          },
          { cycleId: parsed.data.cycleId, ...response },
        );
        if (!result.ok) {
          return {
            questionId: response.questionId,
            status: "failed" as const,
            error: result.error,
            fields: result.fields,
          };
        }
        return {
          questionId: response.questionId,
          status: "succeeded" as const,
          response: result.response,
          evidenceCleanupPending: result.evidenceCleanupPending,
        };
      } catch (error) {
        return {
          questionId: response.questionId,
          status: "failed" as const,
          error: error instanceof Error ? error.message : "Falha não identificada.",
        };
      }
    });

    return NextResponse.json({ results });
  },
);
