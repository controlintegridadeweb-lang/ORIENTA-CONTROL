import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import { consumeRateLimit } from "@/infrastructure/security/rate-limit";
import { processQueuedReportBundles, queueReportBundle } from "@/application/automation/report-bundle-service";
import { logError } from "@/infrastructure/observability/logger";

const bodySchema = z.object({ cycleIds: z.array(z.string().uuid()).min(1).max(50) }).strict();

export const maxDuration = 300;

export const POST = withRoute(
  {
    roles: ["admin"],
    route: "/api/admin/automation/reports",
    logMessage: "Failed to queue report bundle",
    mutationRateLimit: false,
  },
  async ({ request, auth }) => {
    const rateLimit = await consumeRateLimit({
      scope: "report-bundle",
      subject: auth.userId,
      limit: 10,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Muitas solicitações em sequência. Aguarde e tente novamente." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }
    const parsed = bodySchema.parse(await request.json());
    const queued = await queueReportBundle({ cycleIds: parsed.cycleIds, actorUserId: auth.userId });
    // Processa na própria requisição: em dev o `after()` do Next pode não
    // executar o worker, deixando o job eternamente em `pending` enquanto a UI
    // fica no spinner do polling.
    try {
      await processQueuedReportBundles();
    } catch (error) {
      logError("Failed to process report bundle after queue", error, {
        route: "/api/admin/automation/reports",
        jobId: queued.jobId,
      });
    }
    return NextResponse.json(queued, { status: 202 });
  },
);
