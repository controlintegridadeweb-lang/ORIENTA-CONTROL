/**
 * Indicadores da Visão geral do painel admin.
 *
 * Cada contagem reutiliza a mesma fonte da página de destino do card,
 * para o número do KPI coincidir com a listagem aberta pelo link.
 *
 * Escopo atual: administrador global da plataforma (service role no server).
 * Não há filtro por organização/ciclo/período nestes cards.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { getCachedEvidenceMetricsGlobal } from "@/features/dashboard/evidence-metrics";
import {
  isDbActionPlanStatus,
  planStatusFromDb,
  type DbActionPlanStatus,
} from "@/features/improvement-management";
import type { PlanStatus } from "@/features/improvement-management";

type Client = SupabaseClient;

function getClient(): Client {
  return createSupabaseServiceRoleClient();
}

function requireCount(count: number | null, context: string): number {
  if (count == null) {
    throw new Error(`${context}: contagem ausente na resposta do banco.`);
  }
  return count;
}

/** Formulários cuja versão corrente está `published` (mesmo critério de `/admin/formularios?state=published`). */
export async function countPublishedFormsForOverview(
  client: Client = getClient(),
): Promise<number> {
  const { data, error } = await client.rpc("list_forms_page", {
    p_state: "published",
    p_search: undefined,
    p_limit: 1,
    p_offset: 0,
  });
  if (error) throw error;
  return Number(data?.[0]?.total_count ?? 0);
}

/**
 * Evidências (arquivos/links) com status UI `submitted` = aguardando validação.
 * Unidade: linha em `evidence_operational_view` (mesmo de `/admin/evidencias?status=submitted`).
 */
export async function countEvidencesAwaitingValidationForOverview(): Promise<number> {
  const metrics = await getCachedEvidenceMetricsGlobal();
  return metrics.pendingCount;
}

/**
 * Recomendações do processamento oficial corrente
 * (`current_recommendation_read_model` — mesma base de `/admin/recomendacoes`).
 */
export async function countOfficialRecommendationsForOverview(
  client: Client = getClient(),
): Promise<number> {
  const { count, error } = await client
    .from("current_recommendation_read_model")
    .select("recommendation_id", { count: "exact", head: true });
  if (error) throw error;
  return requireCount(count, "countOfficialRecommendationsForOverview");
}

/**
 * Ações com visão operacional `in_progress` (status DB `doing`, não atrasadas).
 * Alinha com `/admin/plano-acao?status=in_progress` (`p_view = in_progress`).
 *
 * No domínio atual, `action_plans` são ações individuais vinculadas a uma
 * recomendação; a página de destino lista essas ações, não recomendações.
 */
export async function countPlansInProgressForOverview(
  client: Client = getClient(),
): Promise<number> {
  const { data, error } = await client.rpc(
    "get_admin_action_plan_monitoring_page",
    {
      p_organization_id: null,
      p_form_id: null,
      p_cycle_id: null,
      p_view: "in_progress",
      p_search: null,
      p_from: null,
      p_to: null,
      p_card_filter: null,
      p_layout: "list",
      p_page: 1,
      p_page_size: 1,
    },
  );
  if (error) throw error;
  if (data == null || typeof data !== "object") {
    throw new Error(
      "countPlansInProgressForOverview: resposta inválida do monitoramento de planos.",
    );
  }
  const total = (data as { total?: unknown }).total;
  if (typeof total !== "number" || !Number.isFinite(total) || total < 0) {
    throw new Error(
      "countPlansInProgressForOverview: total ausente ou inválido.",
    );
  }
  return total;
}

/** Converte o mapa bruto da RPC `get_action_plan_status_metrics` para chaves da UI. */
export function mapActionPlanStatusMetrics(
  rows: ReadonlyArray<{ status: string; total: number | string }>,
): Record<PlanStatus, number> {
  const breakdown: Record<PlanStatus, number> = {
    not_started: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const row of rows) {
    if (!isDbActionPlanStatus(row.status)) continue;
    const ui = planStatusFromDb(row.status as DbActionPlanStatus);
    breakdown[ui] = Number(row.total);
  }
  return breakdown;
}
