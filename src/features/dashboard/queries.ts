import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import {
  countEvidencesAwaitingValidationForOverview,
  countOfficialRecommendationsForOverview,
  countPlansInProgressForOverview,
  countPublishedFormsForOverview,
  mapActionPlanStatusMetrics,
} from "@/features/dashboard/admin-overview-kpis";
import {
  getCachedEvidenceMetricsForOrganization,
  getCachedEvidenceMetricsGlobal,
} from "@/features/dashboard/evidence-metrics";
import {
  getAvailableFamiYearsForCycle,
  resolveLatestFamiContextForOrganization,
} from "@/features/fami/server";
import { adminPlanPendencyHref } from "@/features/admin";
import { loadOpenRecommendationsWithoutPlan } from "@/features/improvement-management/server";
import type { EvidenceStatusBreakdown } from "@/features/dashboard/types";
import type { PlanStatus } from "@/features/improvement-management";

const PENDENCY_AWAITING_ACTION_TITLE = "Aguardando ação da organização";

function recommendationPendencyDescription(text: string): string {
  const line = text.split(/\n+/)[0]?.trim() ?? "";
  if (!line) {
    return "A organização ainda não cadastrou ações para esta recomendação.";
  }
  return line.length > 160 ? `${line.slice(0, 157)}…` : line;
}
export type RecentActivity = {
  id: string;
  eventType: string;
  tableName: string | null;
  createdAt: string;
  actorEmail: string | null;
};

export type PendencyItem = {
  id: string;
  title: string;
  description: string;
  href?: string;
};

type Client = ReturnType<typeof createSupabaseServiceRoleClient>;

function getClient(): Client {
  return createSupabaseServiceRoleClient();
}

/**
 * Formulários ativos na Visão geral = formulários com versão corrente publicada.
 * Fonte alinhada a `/admin/formularios?state=published`.
 */
export async function countActiveForms(): Promise<number> {
  return countPublishedFormsForOverview(getClient());
}

/** Total de perfis com acesso à plataforma (dashboard admin / sistema). */
export async function countProfiles(): Promise<number> {
  const { count, error } = await getClient()
    .from("profiles")
    .select("user_id", { count: "exact", head: true });
  if (error) throw error;
  if (count == null) {
    throw new Error("countProfiles: contagem ausente na resposta do banco.");
  }
  return count;
}

/** Relatórios oficiais gerados e persistidos em `reports`. */
export async function countReportsGenerated(): Promise<number> {
  const { count, error } = await getClient()
    .from("reports")
    .select("id", { count: "exact", head: true })
    .in("status", ["completed", "legacy"]);
  if (error) throw error;
  return count ?? 0;
}

export async function countPendingEvidencesGlobal(): Promise<number> {
  return countEvidencesAwaitingValidationForOverview();
}

/** Recomendações oficiais do read model (não a tabela bruta `recommendations`). */
export async function countRecommendationsGlobal(): Promise<number> {
  return countOfficialRecommendationsForOverview(getClient());
}

/** Ações em andamento na mesma definição de `/admin/plano-acao?status=in_progress`. */
export async function countPlansInProgressGlobal(): Promise<number> {
  return countPlansInProgressForOverview(getClient());
}

export async function countActionPlansByStatusGlobal(): Promise<
  Record<PlanStatus, number>
> {
  const client = getClient();
  const { data, error } = await client.rpc("get_action_plan_status_metrics", {});
  if (error) throw error;
  return mapActionPlanStatusMetrics(data ?? []);
}

export async function evidenceStatusBreakdownGlobal(): Promise<EvidenceStatusBreakdown> {
  const metrics = await getCachedEvidenceMetricsGlobal();
  return metrics.breakdown;
}

export type AdminPendenciesResult = {
  items: PendencyItem[];
  total: number;
};

export async function adminPendenciesGlobal(
  limit = 8,
): Promise<AdminPendenciesResult> {
  const client = getClient();
  const open = await loadOpenRecommendationsWithoutPlan(client, undefined, limit);

  return {
    total: open.total,
    items: open.items.map((r) => ({
      id: r.id,
      title: PENDENCY_AWAITING_ACTION_TITLE,
      description: recommendationPendencyDescription(r.text),
      href: adminPlanPendencyHref(r.id),
    })),
  };
}

/** Anos com processamentos globais (para filtro na UI do dashboard da mesma forma base). */
export async function maturityDashboardAvailableYearsForOrganization(
  organizationId: string,
): Promise<number[]> {
  const baseline =
    await resolveLatestFamiContextForOrganization(organizationId);
  if (!baseline) return [];
  return getAvailableFamiYearsForCycle(baseline.cycleId);
}

export async function evidenceStatusBreakdown(
  organizationId: string,
): Promise<EvidenceStatusBreakdown> {
  const metrics = await getCachedEvidenceMetricsForOrganization(organizationId);
  return metrics.breakdown;
}

export async function recentActivities(limit = 8): Promise<RecentActivity[]> {
  const client = getClient();
  const { data: logs } = await client
    .from("audit_logs")
    .select("id,event_type,entity_type,created_at,actor_user_id")
    .order("created_at", { ascending: false })
    .limit(limit);

  const actorIds = [
    ...new Set(
      (logs ?? [])
        .map((l) => l.actor_user_id as string | null)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  const displayByActor = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await client
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", actorIds);
    for (const p of profiles ?? []) {
      const userId = p.user_id as string;
      const name = (p.full_name as string | null)?.trim();
      if (name) displayByActor.set(userId, name);
    }
  }

  return (logs ?? []).map((log) => ({
    id: log.id as string,
    eventType: log.event_type as string,
    tableName: (log.entity_type as string | null) ?? null,
    createdAt: log.created_at as string,
    actorEmail: log.actor_user_id
      ? (displayByActor.get(log.actor_user_id as string) ?? null)
      : null,
  }));
}

export type AutomationQueueHealth = {
  pendingJobs: number;
  processingJobs: number;
  failedJobs: number;
  oldestPendingJobAt: string | null;
  pendingNotifications: number;
  processingNotifications: number;
  failedNotifications: number;
  oldestPendingNotificationAt: string | null;
  averageJobDurationMs: number | null;
};

export async function getAutomationQueueHealth(): Promise<AutomationQueueHealth> {
  const { data, error } = await getClient().rpc("get_automation_queue_metrics");
  if (error) throw error;
  const row = data?.[0];
  return {
    pendingJobs: Number(row?.pending_jobs ?? 0),
    processingJobs: Number(row?.processing_jobs ?? 0),
    failedJobs: Number(row?.failed_jobs ?? 0),
    oldestPendingJobAt: row?.oldest_pending_job_at ?? null,
    pendingNotifications: Number(row?.pending_notifications ?? 0),
    processingNotifications: Number(row?.processing_notifications ?? 0),
    failedNotifications: Number(row?.failed_notifications ?? 0),
    oldestPendingNotificationAt: row?.oldest_pending_notification_at ?? null,
    averageJobDurationMs:
      row?.average_job_duration_ms === null || row?.average_job_duration_ms === undefined
        ? null
        : Number(row.average_job_duration_ms),
  };
}
