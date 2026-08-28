import { after, NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import { refreshOperationalNotificationsForRead } from "@/application/automation/notification-dispatch-service";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";

const patchSchema = z.object({
  notificationIds: z.array(z.string().uuid()).max(100).optional(),
  markAllRead: z.boolean().optional(),
}).strict().refine((value) => value.markAllRead || (value.notificationIds?.length ?? 0) > 0, {
  message: "Selecione notificações ou informe markAllRead.",
});

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  kinds: z.string().optional(),
});

function parseNotificationKinds(raw: string | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map((kind) => kind.trim()).filter(Boolean))].slice(0, 20);
}

export const GET = withRoute(
  { roles: ["admin", "respondent"], route: "/api/notifications" },
  async ({ auth, request }) => {
    const parsedQuery = querySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    const limit = parsedQuery.success ? (parsedQuery.data.limit ?? 20) : 20;
    const kinds = parsedQuery.success
      ? parseNotificationKinds(parsedQuery.data.kinds)
      : [];
    // Avisos transacionais já existem antes desta leitura. A atualização de
    // lembretes de prazo é complementar e não deve atrasar a abertura do sino.
    after(() => refreshOperationalNotificationsForRead());

    const client = createSupabaseServiceRoleClient();
    const now = new Date().toISOString();
    let notificationsQuery = client
      .from("user_notifications")
      .select("id,kind,title,message,action_path,visible_at,read_at,created_at")
      .eq("user_id", auth.userId)
      .lte("visible_at", now);
    if (kinds.length > 0) {
      notificationsQuery = notificationsQuery.in("kind", kinds);
    }
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      notificationsQuery.order("visible_at", { ascending: false }).limit(limit),
      client
        .from("user_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.userId)
        .lte("visible_at", now)
        .is("read_at", null),
    ]);
    if (error) throw error;
    if (countError) throw countError;
    return NextResponse.json({ notifications: data ?? [], unreadCount: count ?? 0 });
  },
);

export const PATCH = withRoute(
  { roles: ["admin", "respondent"], route: "/api/notifications" },
  async ({ request, auth }) => {
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, { status: 400 });
    }

    const client = createSupabaseServiceRoleClient();
    let query = client
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", auth.userId)
      .is("read_at", null);
    if (!parsed.data.markAllRead) {
      query = query.in("id", parsed.data.notificationIds ?? []);
    }
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ ok: true });
  },
);
