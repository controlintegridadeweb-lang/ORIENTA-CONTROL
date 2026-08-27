import { createCronRoute } from "@/application/automation/create-cron-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { closeDuePreliminaryQuadrimesters } from "@/features/fami/preliminary/close-due-service";
import { closeDueBimonthlyReports } from "@/features/improvement-management/monitoring/bimonthly/close-due-service";

export const dynamic = "force-dynamic";

const run = createCronRoute({
  route: "/api/maintenance/fami-preliminary-close",
  execute: async () => {
    const client = createSupabaseServiceRoleClient();
    const bimonthly = await closeDueBimonthlyReports(client);
    const preliminary = await closeDuePreliminaryQuadrimesters(client);
    return { bimonthly, preliminary };
  },
  resultKey: "closing",
  logMessage: "Failed to close due tracking periods",
  publicError: "Falha ao fechar o acompanhamento bimestral e o FAMI preliminar.",
});

export const GET = run;
export const POST = run;
