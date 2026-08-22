import { createCronRoute } from "@/application/automation/create-cron-route";
import { dispatchPendingNotifications } from "@/application/automation/notification-dispatch-service";

export const dynamic = "force-dynamic";

const run = createCronRoute({
  route: "/api/maintenance/notifications/dispatch",
  execute: dispatchPendingNotifications,
  resultKey: "result",
  logMessage: "Failed to dispatch pending notifications",
  publicError: "Falha ao enviar notificações pendentes.",
});

export const GET = run;
export const POST = run;
