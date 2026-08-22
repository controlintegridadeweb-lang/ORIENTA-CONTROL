import { createCronRoute } from "@/application/automation/create-cron-route";
import { processDueCycleAutomations } from "@/application/automation/scheduled-cycle-service";

export const dynamic = "force-dynamic";

const run = createCronRoute({
  route: "/api/maintenance/cycle-jobs",
  execute: processDueCycleAutomations,
  resultKey: "results",
  logMessage: "Failed to process scheduled cycle jobs",
  publicError: "Falha ao processar operações programadas.",
});

export const GET = run;
export const POST = run;
