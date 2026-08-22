import { createCronRoute } from "@/application/automation/create-cron-route";
import { processQueuedImports } from "@/application/automation/import-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const run = createCronRoute({
  route: "/api/maintenance/imports",
  execute: processQueuedImports,
  resultKey: "results",
  logMessage: "Failed to process queued imports",
  publicError: "Falha ao processar importações enfileiradas.",
});

export const GET = run;
export const POST = run;
