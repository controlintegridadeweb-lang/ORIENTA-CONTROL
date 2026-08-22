import { createCronRoute } from "@/application/automation/create-cron-route";
import { enqueueOperationalNotifications } from "@/application/automation/notification-dispatch-service";

export const dynamic = "force-dynamic";

const run = createCronRoute({
  route: "/api/maintenance/notifications/enqueue",
  execute: enqueueOperationalNotifications,
  resultKey: "queued",
  logMessage: "Failed to enqueue operational notifications",
  publicError: "Falha ao enfileirar notificações.",
});

export const GET = run;
export const POST = run;
