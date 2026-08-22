import { createCronRoute } from "@/application/automation/create-cron-route";
import { processQueuedReportBundles } from "@/application/automation/report-bundle-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const run = createCronRoute({
  route: "/api/maintenance/report-bundles",
  execute: processQueuedReportBundles,
  resultKey: "results",
  logMessage: "Failed to process report bundles",
  publicError: "Falha ao processar pacotes de relatórios.",
});

export const GET = run;
export const POST = run;
