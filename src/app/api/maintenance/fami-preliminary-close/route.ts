import { createCronRoute } from "@/application/automation/create-cron-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { closeDuePreliminaryQuadrimesters } from "@/features/fami/preliminary/close-due-service";

export const dynamic = "force-dynamic";

const run = createCronRoute({
  route: "/api/maintenance/fami-preliminary-close",
  execute: async () => {
    return closeDuePreliminaryQuadrimesters(createSupabaseServiceRoleClient());
  },
  resultKey: "closing",
  logMessage: "Failed to close due FAMI preliminary quadrimesters",
  publicError: "Falha ao fechar o acompanhamento quadrimestral do FAMI preliminar.",
});

export const GET = run;
export const POST = run;
