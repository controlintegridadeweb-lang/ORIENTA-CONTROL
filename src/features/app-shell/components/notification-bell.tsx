"use client";

import { typography } from "@/shared/layout/design-system";

import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { parseJson } from "@/infrastructure/api/fetch-client";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";

const notificationItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  message: z.string(),
  action_path: z.string().nullable(),
  visible_at: z.string(),
  read_at: z.string().nullable(),
}).passthrough();

const notificationListResponseSchema = z.object({
  notifications: z.array(notificationItemSchema),
  unreadCount: z.number().int().nonnegative(),
}).passthrough();

type NotificationItem = z.infer<typeof notificationItemSchema>;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const applyPayload = useCallback((payload: {
    notifications: NotificationItem[];
    unreadCount: number;
  }) => {
    setItems(payload.notifications);
    setUnreadCount(payload.unreadCount);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível carregar as notificações.");
      const payload = await parseJson(response, notificationListResponseSchema);
      applyPayload(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar as notificações.");
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  const refreshQuiet = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await parseJson(response, notificationListResponseSchema);
      applyPayload(payload);
    } catch {
      // A abertura do painel oferece nova tentativa e mensagem persistente.
    }
  }, [applyPayload]);

  useEffect(() => {
    let active = true;
    const POLL_MS = 45_000;

    // O efeito registra as sincronizações; a primeira leitura ocorre como
    // tarefa agendada, fora do corpo síncrono da montagem.
    const initialRefreshId = window.setTimeout(() => {
      if (active) void refreshQuiet();
    }, 0);

    const intervalId = window.setInterval(() => {
      if (!active) return;
      if (document.visibilityState !== "visible") return;
      void refreshQuiet();
    }, POLL_MS);

    function onVisibilityChange() {
      if (!active) return;
      if (document.visibilityState === "visible") void refreshQuiet();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      window.clearTimeout(initialRefreshId);
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshQuiet]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function markRead(notificationIds: string[]) {
    if (notificationIds.length === 0) return;
    const readAt = new Date().toISOString();
    const unreadIds = new Set(
      items.filter((item) => notificationIds.includes(item.id) && !item.read_at).map((item) => item.id),
    );
    if (unreadIds.size === 0) return;

    setItems((current) => current.map((item) => (
      unreadIds.has(item.id) ? { ...item, read_at: readAt } : item
    )));
    setUnreadCount((current) => Math.max(0, current - unreadIds.size));

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notificationIds: Array.from(unreadIds) }),
        keepalive: true,
      });
      if (!response.ok) throw new Error("Falha HTTP ao marcar notificação.");
    } catch {
      await load();
      setError("Não foi possível marcar a notificação como lida.");
    }
  }

  async function markAllRead() {
    if (markingAllRead) return;
    setMarkingAllRead(true);
    setError(null);
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (!response.ok) throw new Error("Falha HTTP ao marcar notificações.");
      const readAt = new Date().toISOString();
      setUnreadCount(0);
      setItems((current) => current.map((item) => ({
        ...item,
        read_at: item.read_at ?? readAt,
      })));
    } catch {
      setError("Não foi possível marcar todas as notificações como lidas.");
    } finally {
      setMarkingAllRead(false);
    }
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Notificações${unreadCount > 0 ? `, ${unreadCount} não lida${unreadCount === 1 ? "" : "s"}` : ""}`}
        aria-expanded={open}
        aria-controls="notifications-panel"
        onClick={() => {
          setOpen((current) => !current);
          if (!open) void load();
        }}
        className="relative inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        <Bell className="size-5" aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-semibold leading-5 text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <section
          ref={panelRef}
          id="notifications-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="notifications-title"
          tabIndex={-1}
          className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl focus:outline-none"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 id="notifications-title" className={typography.cardTitle}>Notificações</h2>
            {unreadCount > 0 ? (
              <button
                type="button"
                disabled={markingAllRead}
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-950 disabled:cursor-wait disabled:opacity-60"
              >
                <CheckCheck className="size-4" aria-hidden />
                {markingAllRead ? "Marcando…" : "Marcar todas como lidas"}
              </button>
            ) : null}
          </div>
          {error ? (
            <div className="border-b border-slate-200 p-3">
              <AsyncErrorState
                compact
                message={error}
                onRetry={load}
                retrying={loading}
              />
            </div>
          ) : null}
          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-600">Carregando notificações…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-600">Nenhuma notificação disponível.</p>
            ) : (
              items.map((item) => {
                const content = (
                  <div className={`border-b border-slate-100 px-4 py-3 last:border-b-0 ${item.read_at ? "bg-white" : "bg-slate-50"}`}>
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-600">{item.message}</p>
                    <time className="mt-2 block text-xs text-slate-500" dateTime={item.visible_at}>
                      {formatPlatformDateTime(item.visible_at, { dateStyle: "short", timeStyle: "short" })}
                    </time>
                  </div>
                );
                return item.action_path ? (
                  <Link
                    key={item.id}
                    href={item.action_path}
                    onClick={() => {
                      setOpen(false);
                      void markRead([item.id]);
                    }}
                    className="block hover:bg-slate-50"
                  >
                    {content}
                  </Link>
                ) : item.read_at ? (
                  <div key={item.id}>{content}</div>
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void markRead([item.id])}
                    className="block w-full text-left hover:bg-slate-50"
                  >
                    {content}
                  </button>
                );
              })
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
