import "server-only";

import { randomUUID } from "node:crypto";
import { mapConcurrent } from "@/shared/async/map-concurrent";
import { logError } from "@/infrastructure/observability/logger";
import { consumeRateLimit } from "@/infrastructure/security/rate-limit";
import type { Json } from "@/infrastructure/supabase/database.types";
import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";

const MAX_DISPATCH = 40;
const DISPATCH_CONCURRENCY = 4;
const DISPATCH_TIMEOUT_MS = 15_000;
const RETRY_BASE_MINUTES = 5;
const RETRY_MAX_HOURS = 6;

type ClaimedNotification = {
  id: string;
  recipient_user_id: string | null;
  recipient_email: string | null;
  kind: string;
  payload: Json;
  attempts: number;
  max_attempts: number;
};

export type NotificationDispatchResult = {
  configured: boolean;
  selected: number;
  sent: number;
  failed: number;
  cancelled: number;
  pending: number;
};

async function countPending(client: TypedSupabaseClient): Promise<number> {
  const { count, error } = await client
    .from("notification_outbox")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString());
  if (error) throw error;
  return count ?? 0;
}

function nextRetryAt(attempts: number): string {
  const exponent = Math.max(0, attempts - 1);
  const delayMinutes = Math.min(RETRY_BASE_MINUTES * 2 ** exponent, RETRY_MAX_HOURS * 60);
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

async function markSent(client: TypedSupabaseClient, id: string): Promise<void> {
  const { error } = await client
    .from("notification_outbox")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      last_error: null,
      locked_at: null,
      locked_by: null,
    })
    .eq("id", id);
  if (error) throw error;
}

async function markFailed(
  client: TypedSupabaseClient,
  notification: ClaimedNotification,
  message: string,
): Promise<void> {
  const exhausted = notification.attempts >= notification.max_attempts;
  const update = {
    status: exhausted ? ("failed" as const) : ("pending" as const),
    last_error: message,
    locked_at: null,
    locked_by: null,
    ...(!exhausted ? { scheduled_for: nextRetryAt(notification.attempts) } : {}),
  };
  const { error } = await client
    .from("notification_outbox")
    .update(update)
    .eq("id", notification.id);
  if (error) throw error;
}

export async function enqueueOperationalNotifications(): Promise<number> {
  const client = createSupabaseServiceRoleClient();
  const { data, error } = await client.rpc("enqueue_operational_notifications");
  if (error) throw error;
  const payload = data as { queued?: number } | null;
  return Number(payload?.queued ?? 0);
}

const IN_APP_ENQUEUE_WINDOW_SECONDS = 5 * 60;

/**
 * Atualiza em segundo plano avisos operacionais e lembretes de prazo após uma
 * leitura in-app. O cron horário continua responsável pela outbox; esta rodada
 * complementar reduz a defasagem no ambiente local e entre execuções do worker.
 */
export async function refreshOperationalNotificationsForRead(): Promise<void> {
  try {
    const limit = await consumeRateLimit({
      scope: "notifications-enqueue-on-read",
      subject: "global",
      limit: 1,
      windowSeconds: IN_APP_ENQUEUE_WINDOW_SECONDS,
    });
    if (!limit.allowed) return;
    await enqueueOperationalNotifications();
    if (!process.env.NOTIFICATION_WEBHOOK_URL?.trim()) {
      await cancelUndeliverableExternalNotifications(
        createSupabaseServiceRoleClient(),
      );
    }
  } catch (error) {
    logError("Failed to refresh operational notifications before read", error, {
      route: "/api/notifications",
    });
  }
}

async function cancelUndeliverableExternalNotifications(
  client: TypedSupabaseClient,
): Promise<number> {
  const { data, error } = await client
    .from("notification_outbox")
    .update({
      status: "cancelled",
      last_error: "Integração externa não configurada; notificação interna preservada.",
      locked_at: null,
      locked_by: null,
    })
    .eq("status", "pending")
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function dispatchPendingNotifications(): Promise<NotificationDispatchResult> {
  const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL?.trim();
  const webhookSecret = process.env.NOTIFICATION_WEBHOOK_SECRET?.trim();
  const client = createSupabaseServiceRoleClient();

  if (!webhookUrl) {
    const cancelled = await cancelUndeliverableExternalNotifications(client);
    return {
      configured: false,
      selected: 0,
      sent: 0,
      failed: 0,
      cancelled,
      pending: await countPending(client),
    };
  }

  const workerId = `notification:${randomUUID()}`;
  const { data, error } = await client.rpc("claim_notification_outbox", {
    p_worker_id: workerId,
    p_limit: MAX_DISPATCH,
    p_lock_timeout: "10 minutes",
  });
  if (error) throw error;

  const claimed: ClaimedNotification[] = (data ?? []).map((row) => ({
    id: String(row.id),
    recipient_user_id: row.recipient_user_id ? String(row.recipient_user_id) : null,
    recipient_email: row.recipient_email ? String(row.recipient_email) : null,
    kind: String(row.kind),
    payload: row.payload,
    attempts: Number(row.attempts),
    max_attempts: Number(row.max_attempts),
  }));

  const outcomes = await mapConcurrent(
    claimed,
    DISPATCH_CONCURRENCY,
    async (notification): Promise<"sent" | "failed"> => {
      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(webhookSecret ? { authorization: `Bearer ${webhookSecret}` } : {}),
          },
          body: JSON.stringify({
            outboxId: notification.id,
            recipientUserId: notification.recipient_user_id,
            recipientEmail: notification.recipient_email,
            kind: notification.kind,
            payload: notification.payload,
          }),
          signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
        });
        if (!response.ok) {
          throw new Error(`O dispatcher respondeu HTTP ${response.status}.`);
        }
        await markSent(client, notification.id);
        return "sent";
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "Falha não identificada no dispatcher.";
        await markFailed(client, notification, message);
        return "failed";
      }
    },
  );

  return {
    configured: true,
    selected: claimed.length,
    sent: outcomes.filter((status) => status === "sent").length,
    failed: outcomes.filter((status) => status === "failed").length,
    cancelled: 0,
    pending: await countPending(client),
  };
}
