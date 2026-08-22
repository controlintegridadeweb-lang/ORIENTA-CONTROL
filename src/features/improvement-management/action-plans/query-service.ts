/**
 * Consultas de planos de ação, recomendações e histórico de auditoria.
 * Escritas operacionais pertencem exclusivamente ao serviço de comando do
 * respondente; pareceres administrativos permanecem em serviço próprio.
 */
import { z } from "zod";
import { buildActionPlanByCyclePayload } from "@/features/improvement-management/action-plans/domain-model";
import { isGlobalAdmin } from "@/infrastructure/auth/scope";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { resolveCycleOperationalScope } from "@/infrastructure/supabase/cycle-operational-scope";
import { listActionPlansQuerySchema, historyPaginationSchema } from "./schemas";
import {
  loadRecommendationScope,
  queryActionPlanRecommendationRows,
} from "./cycle-read-model";
import {
  ActionPlansNotFoundError,
  enforceOrgScope,
  parseOrThrow,
  type Caller,
  type Client,
} from "./access";
import { toListItem } from "./mappers";
import { isDbActionPlanStatus, planStatusFromDb } from "./plan-status-map";
import type {
  ActionPlanAuditEntry,
  ActionPlanProgressUpdate,
  RecommendationActionPlanAuditEntry,
  PaginatedHistory,
  ActionPlanByCyclePayload,
  ActionPlanListItem,
  ActionPlansListResult,
} from "./types";

export class ActionPlansQueryService {
  private supabase: Client;

  constructor(client?: Client) {
    this.supabase = client ?? createSupabaseServiceRoleClient();
  }

  /**
   * Leitura canônica do plano associado a um ciclo específico. Relatórios e
   * outras operações não aceitam mais o par formulário/organização como chave.
   */
  async getByCycle(
    cycleId: string,
    caller: Caller,
  ): Promise<ActionPlanByCyclePayload | null> {
    return this.getByCycleSnapshot(cycleId, caller);
  }

  /**
   * Leitura histórica para um processamento FAMI específico. Relatórios usam
   * esta variante para não misturar recomendações, dispensas e ações criadas
   * após a versão selecionada.
   */
  async getByProcessing(
    cycleId: string,
    cycleProcessingId: string,
    caller: Caller,
  ): Promise<ActionPlanByCyclePayload | null> {
    return this.getByCycleSnapshot(cycleId, caller, cycleProcessingId);
  }

  private async getByCycleSnapshot(
    cycleId: string,
    caller: Caller,
    cycleProcessingId?: string,
  ): Promise<ActionPlanByCyclePayload | null> {
    const scope = await resolveCycleOperationalScope(this.supabase, cycleId);
    if (!scope) return null;
    if (!isGlobalAdmin(caller)) {
      if (!caller.organizationId || caller.organizationId !== scope.cycle.organizationId) {
        throw new ActionPlansNotFoundError();
      }
    }

    const [rows, formResult, organizationResult, formVersionResult] = await Promise.all([
      queryActionPlanRecommendationRows(this.supabase, { cycleId, cycleProcessingId }),
      this.supabase.from("forms").select("id,name").eq("id", scope.formId).maybeSingle(),
      this.supabase
        .from("organizations")
        .select("id,name")
        .eq("id", scope.cycle.organizationId)
        .maybeSingle(),
      this.supabase
        .from("form_versions")
        .select("version")
        .eq("id", scope.cycle.formVersionId)
        .maybeSingle(),
    ]);
    if (!formResult.data?.id || !organizationResult.data?.id) return null;

    return buildActionPlanByCyclePayload({
      cycleId,
      formId: scope.formId,
      formName: String(formResult.data.name),
      formVersion: Number(formVersionResult.data?.version ?? 0),
      organizationId: scope.cycle.organizationId,
      organizationName: String(organizationResult.data.name),
      recommendationRows: rows,
    });
  }

  /**
   * Leitura exata de uma recomendação para a tela de detalhe.
   *
   * Não reutiliza paginação nem depende de `items[0]`: o ID solicitado é
   * validado contra o processamento oficial corrente e contra o escopo do
   * usuário antes de montar o item.
   */
  async getByRecommendation(
    recommendationId: string,
    caller: Caller,
  ): Promise<ActionPlanListItem | null> {
    const scope = await loadRecommendationScope(this.supabase, recommendationId);
    if (!scope) return null;
    enforceOrgScope(caller, scope.organizationId);

    const rows = await queryActionPlanRecommendationRows(this.supabase, {
      recommendationId,
      cycleId: scope.cycleId,
      organizationId: scope.organizationId,
    });
    const row = rows.find((candidate) => candidate.id === recommendationId);
    return row ? toListItem(row) : null;
  }

  async list(rawQuery: unknown, caller: Caller): Promise<ActionPlansListResult> {
    const query = parseOrThrow(listActionPlansQuerySchema, rawQuery);

    if (!isGlobalAdmin(caller) && !caller.organizationId) {
      return {
        items: [],
        total: 0,
        limit: query.limit,
        offset: query.offset,
        view: query.view,
      };
    }

    const effectiveOrgId = isGlobalAdmin(caller)
      ? query.organizationId
      : caller.organizationId ?? undefined;
    const { data, error } = await this.supabase.rpc(
      "list_action_plan_recommendations_page",
      {
        p_cycle_id: query.cycleId ?? null,
        p_organization_id: effectiveOrgId ?? null,
        p_form_id: query.formId ?? null,
        p_recommendation_id: query.recommendationId ?? null,
        p_view: query.view,
        p_recommendation_status: query.recommendationStatus ?? null,
        p_plan_status: query.planStatus ?? null,
        p_responsible_contains: query.responsibleContains ?? null,
        p_search: query.search ?? null,
        p_due_filter: query.dueFilter ?? "all",
        p_limit: query.limit,
        p_offset: query.offset,
      },
    );
    if (error) throw error;

    const rowSchema = z.object({
      recommendation_id: z.string().min(1),
      cycle_id: z.string().min(1),
      cycle_state: z.string(),
      period_label: z.string(),
      form_id: z.string().min(1),
      form_name: z.string(),
      form_version: z.number(),
      organization_id: z.string().min(1),
      organization_name: z.string(),
      question_id: z.string().min(1),
      question_prompt: z.string(),
      section_id: z.string().min(1),
      section_name: z.string(),
      section_order: z.number().int().optional().default(0),
      axis_id: z.string().min(1),
      axis_name: z.string(),
      question_order: z.number().int().optional().default(0),
      recommendation_type: z.string(),
      recommendation_text: z.string(),
      recommendation_status: z.enum([
        "generated", "in_action_plan", "awaiting_approval", "adjustment_requested",
        "exception_requested", "completed", "dismissed",
      ]),
      recommendation_created_at: z.string(),
      action_plans: z.array(z.object({
        id: z.string().min(1),
        action_text: z.string().nullable().optional(),
        start_date: z.string().nullable().optional(),
        due_date: z.string().nullable().optional(),
        responsible_user_id: z.string().nullable().optional(),
        responsible_label: z.string().nullable().optional(),
        progress_percentage: z.number().int().min(0).max(100),
        status: z.string().nullable().optional(),
        execution_notes: z.string().nullable().optional(),
        updated_at: z.string().nullable().optional(),
        revision: z.number().int().positive().optional(),
        documents: z.array(z.object({
          id: z.string().min(1),
          action_revision: z.number().int().positive(),
          kind: z.enum(["file", "link"]),
          title: z.string(),
          external_link: z.string().nullable().optional(),
          original_filename: z.string().nullable().optional(),
          mime_type: z.string().nullable().optional(),
          size_bytes: z.number().nullable().optional(),
          file_validation_status: z.enum([
            "not_applicable", "valid", "rejected", "removed",
          ]),
          validated_at: z.string().nullable().optional(),
          created_at: z.string(),
        })).default([]),
      })),
      total_count: z.number(),
    });
    const rows = z.array(rowSchema).parse(data ?? []);
    const items = rows.map((row) =>
      toListItem({
        id: row.recommendation_id,
        cycle_id: row.cycle_id,
        period_label: row.period_label,
        cycle_state: row.cycle_state,
        form_id: row.form_id,
        organization_id: row.organization_id,
        recommendation_type: row.recommendation_type,
        current_text: row.recommendation_text,
        status: row.recommendation_status,
        question_id: row.question_id,
        axis_id: row.axis_id,
        section_order: row.section_order,
        question_order: row.question_order,
        forms: { id: row.form_id, name: row.form_name, version: row.form_version },
        organizations: { id: row.organization_id, name: row.organization_name },
        questions: {
          id: row.question_id,
          prompt: row.question_prompt,
          section_id: row.section_id,
          section_order: row.section_order,
          question_order: row.question_order,
          sections: {
            name: row.section_name,
            axes: { id: row.axis_id, name: row.axis_name },
          },
        },
        action_plans: row.action_plans,
        created_at: row.recommendation_created_at,
      }),
    );

    return {
      items,
      total: Number(rows[0]?.total_count ?? 0),
      limit: query.limit,
      offset: query.offset,
      view: query.view,
    };
  }

  private async requirePlanScope(planId: string, caller: Caller): Promise<void> {
    const { data: plan, error: pErr } = await this.supabase
      .from("action_plans")
      .select("id, recommendation_id")
      .eq("id", planId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!plan) throw new ActionPlansNotFoundError("Plano não encontrado.");

    const { data: rec, error: rErr } = await this.supabase
      .from("recommendations")
      .select("id, cycles!inner(organization_id)")
      .eq("id", plan.recommendation_id as string)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!rec) throw new ActionPlansNotFoundError();
    const organizationId = z
      .object({ cycles: z.object({ organization_id: z.string().min(1) }) })
      .parse(rec).cycles.organization_id;
    enforceOrgScope(caller, organizationId);
  }

  async listPlanProgressUpdates(
    planId: string,
    caller: Caller,
  ): Promise<ActionPlanProgressUpdate[]> {
    await this.requirePlanScope(planId, caller);

    const { data, error } = await this.supabase
      .from("action_plan_progress_updates")
      .select(
        "id, previous_percentage, new_percentage, previous_status, new_status, description, created_at, created_by",
      )
      .eq("action_plan_id", planId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (error) throw error;

    const rows = z
      .array(
        z.object({
          id: z.string().min(1),
          previous_percentage: z.number().int().min(0).max(100),
          new_percentage: z.number().int().min(0).max(100),
          previous_status: z.string(),
          new_status: z.string(),
          description: z.string().nullable(),
          created_at: z.string(),
          created_by: z.string().min(1),
        }),
      )
      .parse(data ?? []);

    const actorIds = [...new Set(rows.map((row) => row.created_by))];
    const nameByUserId = new Map<string, string>();
    if (actorIds.length > 0) {
      const { data: profiles, error: profilesError } = await this.supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", actorIds);
      if (profilesError) throw profilesError;
      for (const profile of profiles ?? []) {
        const userId = String(profile.user_id ?? "");
        if (!userId) continue;
        const fullName = String(profile.full_name ?? "").trim();
        nameByUserId.set(userId, fullName || "Responsável não informado");
      }
    }

    return rows.map((row) => {
      if (!isDbActionPlanStatus(row.previous_status) || !isDbActionPlanStatus(row.new_status)) {
        throw new Error("Situação inválida no histórico de atualização da ação.");
      }
      return {
        id: row.id,
        previousPercentage: row.previous_percentage,
        newPercentage: row.new_percentage,
        previousStatus: planStatusFromDb(row.previous_status),
        newStatus: planStatusFromDb(row.new_status),
        description: row.description,
        createdAt: row.created_at,
        createdByName: nameByUserId.get(row.created_by) ?? "Responsável não informado",
      };
    });
  }

  async listPlanAudit(
    planId: string,
    caller: Caller,
    rawPagination: unknown = {},
  ): Promise<PaginatedHistory<ActionPlanAuditEntry>> {
    await this.requirePlanScope(planId, caller);

    const pagination = parseOrThrow(historyPaginationSchema, rawPagination);
    const { data: logs, error: lErr, count } = await this.supabase
      .from("audit_logs")
      .select("id, event_type, created_at, actor_user_id, before_json, after_json", { count: "exact" })
      .eq("entity_type", "action_plans")
      .eq("record_id", planId)
      .order("created_at", { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit - 1);
    if (lErr) throw lErr;

    const items = (logs ?? []).map((row) => ({
      id: row.id as string,
      eventType: row.event_type as string,
      createdAt: row.created_at as string,
      actorId: (row.actor_user_id as string | null) ?? null,
      oldValue: row.before_json,
      newValue: row.after_json,
    }));
    const total = count ?? 0;
    return {
      items,
      total,
      limit: pagination.limit,
      offset: pagination.offset,
      hasMore: pagination.offset + items.length < total,
    };
  }

  async listRecommendationAudit(
    recommendationId: string,
    caller: Caller,
    rawPagination: unknown = {},
  ): Promise<PaginatedHistory<RecommendationActionPlanAuditEntry>> {
    const scope = await loadRecommendationScope(this.supabase, recommendationId);
    if (!scope) throw new ActionPlansNotFoundError("Recomendação não encontrada.");
    enforceOrgScope(caller, scope.organizationId);

    const pagination = parseOrThrow(historyPaginationSchema, rawPagination);
    const { data: plans, error: plansError } = await this.supabase
      .from("action_plans")
      .select("id, action_text")
      .eq("recommendation_id", recommendationId);
    if (plansError) throw plansError;

    const labels = new Map<string, string>();
    for (const plan of plans ?? []) {
      const text = String(plan.action_text ?? "").trim();
      labels.set(String(plan.id), text.length > 100 ? `${text.slice(0, 100)}…` : text);
    }
    const planIds = Array.from(labels.keys());
    if (planIds.length === 0) {
      return { items: [], total: 0, limit: pagination.limit, offset: pagination.offset, hasMore: false };
    }

    const { data: logs, error: logsError, count } = await this.supabase
      .from("audit_logs")
      .select("id, event_type, created_at, actor_user_id, before_json, after_json, record_id", { count: "exact" })
      .eq("entity_type", "action_plans")
      .in("record_id", planIds)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit - 1);
    if (logsError) throw logsError;

    const items = (logs ?? []).map((row) => {
      const actionPlanId = String(row.record_id);
      return {
        id: String(row.id),
        eventType: String(row.event_type),
        createdAt: String(row.created_at),
        actorId: row.actor_user_id ? String(row.actor_user_id) : null,
        oldValue: row.before_json,
        newValue: row.after_json,
        actionPlanId,
        actionLabel: labels.get(actionPlanId) ?? "Ação removida",
      };
    });
    const total = count ?? 0;
    return {
      items,
      total,
      limit: pagination.limit,
      offset: pagination.offset,
      hasMore: pagination.offset + items.length < total,
    };
  }

}
