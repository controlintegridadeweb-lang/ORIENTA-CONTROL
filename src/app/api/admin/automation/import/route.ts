import { after, NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import { consumeRateLimit } from "@/infrastructure/security/rate-limit";
import { previewCsvImport, processQueuedImports, queueCsvImport } from "@/application/automation/import-service";

const bodySchema = z.object({
  kind: z.enum(["organizations", "respondents"]),
  mode: z.enum(["preview", "commit"]),
  csv: z.string().min(1).max(2_000_000),
}).strict();

export const maxDuration = 300;

export const POST = withRoute(
  {
    roles: ["admin"],
    route: "/api/admin/automation/import",
    logMessage: "Failed to import CSV",
    mutationRateLimit: false,
  },
  async ({ request, auth }) => {
    const rateLimit = await consumeRateLimit({
      scope: "admin-import",
      subject: auth.userId,
      limit: 6,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Muitas solicitações em sequência. Aguarde e tente novamente." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, { status: 400 });
    }
    if (parsed.data.mode === "preview") {
      const preview = previewCsvImport(parsed.data.kind, parsed.data.csv);
      return NextResponse.json({ results: preview.results, total: preview.results.length, validCount: preview.validCount });
    }
    const queued = await queueCsvImport({ kind: parsed.data.kind, csv: parsed.data.csv, actorUserId: auth.userId });
    after(async () => {
      await processQueuedImports();
    });
    return NextResponse.json(queued, { status: 202 });
  },
);
