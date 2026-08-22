import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { toListItem } from "@/features/improvement-management/action-plans/mappers";
import { toAdminPlanItem } from "@/features/improvement-management/action-plans/admin-monitoring";
import { toAdminItem } from "@/features/improvement-management/recommendations/admin-presentation";
import { parseOrThrow, type Client } from "@/features/improvement-management/action-plans/access";
import type { RecommendationRowRaw } from "@/features/improvement-management/action-plans/types";
import { recommendationStatusSchema } from "@/shared/domain/recommendation-status";
import {
  adminActionPlanMonitoringQuerySchema,
  adminRecommendationMonitoringQuerySchema,
  type ParsedAdminActionPlanMonitoringQuery,
  type ParsedAdminRecommendationMonitoringQuery,
} from "./schemas";
import type {
  AdminActionPlanMonitoringResult,
  AdminRecommendationMonitoringResult,
} from "./types";

const DB_PAGE_SIZE = 100;

type MonitoringPageResult<Item> = {
  items: Item[];
  total: number;
  paginationTotal: number;
  page: number;
  pageSize: number;
  totalPages: number;
  layout: "list" | "organization";
};

type MonitoringQuery = {
  page: number;
  pageSize: number;
  layout: "list" | "organization";
};

type MonitoringPageLoader<Result> = (
  page?: number,
  pageSize?: number,
  layout?: "list" | "organization",
) => Promise<Result>;

async function loadValidMonitoringPage<
  Item,
  Result extends MonitoringPageResult<Item>,
>(loadPage: MonitoringPageLoader<Result>): Promise<Result> {
  const result = await loadPage();
  if (result.items.length === 0 && result.page > result.totalPages) {
    return loadPage(result.totalPages);
  }
  return result;
}

async function collectMonitoringExport<
  Item,
  Result extends MonitoringPageResult<Item>,
>(query: MonitoringQuery, loadPage: MonitoringPageLoader<Result>): Promise<Result> {
  const first = await loadPage(1, DB_PAGE_SIZE, "list");
  const items = [...first.items];
  for (let page = 2; page <= first.totalPages; page += 1) {
    const current = await loadPage(page, DB_PAGE_SIZE, "list");
    items.push(...current.items);
  }
  return {
    ...first,
    items,
    total: items.length,
    paginationTotal: items.length,
    page: 1,
    pageSize: Math.max(1, items.length),
    totalPages: 1,
    layout: query.layout,
  };
}

const actionPlanDbSchema = z.object({
  id: z.string().uuid(),
  action_text: z.string().nullable(),
  start_date: z.string().nullable().optional(),
  due_date: z.string().nullable(),
  responsible_label: z.string().nullable(),
  progress_percentage: z.number().int().min(0).max(100),
  status: z.enum(["todo", "doing", "done", "cancelled"]),
  execution_notes: z.string().nullable(),
  updated_at: z.string().nullable(),
  revision: z.number().int().positive(),
});

const recommendationMonitoringRowSchema = z.object({
  recommendation_id: z.string().uuid(),
  cycle_id: z.string().uuid(),
  cycle_state: z.string(),
  period_label: z.string(),
  form_id: z.string().uuid(),
  form_name: z.string(),
  form_version: z.number(),
  organization_id: z.string().uuid(),
  organization_name: z.string(),
  question_id: z.string().uuid(),
  question_prompt: z.string(),
  section_id: z.string().uuid(),
  section_name: z.string(),
  section_order: z.number().int().optional().default(0),
  axis_id: z.string().uuid(),
  axis_name: z.string(),
  question_order: z.number().int().optional().default(0),
  recommendation_type: z.string(),
  recommendation_text: z.string(),
  recommendation_status: recommendationStatusSchema,
  recommendation_created_at: z.string(),
  action_plans: z.array(actionPlanDbSchema),
});

type RecommendationMonitoringRow = z.infer<typeof recommendationMonitoringRowSchema>;

const actionPlanMonitoringRowSchema = recommendationMonitoringRowSchema
  .omit({ action_plans: true })
  .extend({
    plan_id: z.string().uuid().nullable(),
    action_text: z.string().nullable(),
    start_date: z.string().nullable().optional(),
    due_date: z.string().nullable(),
    responsible_label: z.string().nullable(),
    progress_percentage: z.number().int().min(0).max(100).nullable(),
    plan_status: z.enum(["todo", "doing", "done", "cancelled"]).nullable(),
    execution_notes: z.string().nullable(),
    updated_at: z.string().nullable(),
    revision: z.number().int().positive().nullable(),
    action_count: z.number().int().nonnegative(),
  });

type ActionPlanMonitoringRow = z.infer<typeof actionPlanMonitoringRowSchema>;

const commonPayloadShape = {
  total: z.number().int().nonnegative(),
  paginationTotal: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().positive(),
  layout: z.enum(["list", "organization"]),
  selectedCycleLabel: z.string().nullable(),
};

const recommendationPayloadSchema = z.object({
  ...commonPayloadShape,
  items: z.array(recommendationMonitoringRowSchema),
  summary: z.object({
    total: z.number().int().nonnegative(),
    withoutPlan: z.number().int().nonnegative(),
    withPlan: z.number().int().nonnegative(),
    inExecution: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    overdue: z.number().int().nonnegative(),
  }),
});

const actionPlanPayloadSchema = z.object({
  ...commonPayloadShape,
  items: z.array(actionPlanMonitoringRowSchema),
  summary: z.object({
    total: z.number().int().nonnegative(),
    inProgress: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    overdue: z.number().int().nonnegative(),
    withoutResponsible: z.number().int().nonnegative(),
    dueSoon: z.number().int().nonnegative(),
    highRisk: z.number().int().nonnegative(),
    lowProgress: z.number().int().nonnegative(),
  }),
});

function toRawRecommendation(
  row: RecommendationMonitoringRow,
  actionPlans = row.action_plans,
): RecommendationRowRaw {
  return {
    id: row.recommendation_id,
    cycle_id: row.cycle_id,
    cycle_state: row.cycle_state,
    period_label: row.period_label,
    form_id: row.form_id,
    organization_id: row.organization_id,
    recommendation_type: row.recommendation_type,
    current_text: row.recommendation_text,
    status: row.recommendation_status,
    question_id: row.question_id,
    axis_id: row.axis_id,
    forms: {
      id: row.form_id,
      name: row.form_name,
      version: row.form_version,
    },
    organizations: {
      id: row.organization_id,
      name: row.organization_name,
    },
    section_order: row.section_order,
    question_order: row.question_order,
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
    action_plans: actionPlans,
    created_at: row.recommendation_created_at,
  };
}

function mapRecommendationRows(rows: RecommendationMonitoringRow[]) {
  return rows.map((row) => toAdminItem(toListItem(toRawRecommendation(row))));
}

function mapActionPlanRows(rows: ActionPlanMonitoringRow[]) {
  return rows.map((row) => {
    const plans = row.plan_id && row.plan_status
      ? [{
          id: row.plan_id,
          action_text: row.action_text,
          start_date: row.start_date,
          due_date: row.due_date,
          responsible_label: row.responsible_label,
          progress_percentage: row.progress_percentage ?? 0,
          status: row.plan_status,
          execution_notes: row.execution_notes,
          updated_at: row.updated_at,
          revision: row.revision ?? 1,
        }]
      : [];
    const listItem = toListItem(toRawRecommendation({ ...row, action_plans: plans }, plans));
    listItem.recommendationActionCount = row.action_count;
    return toAdminPlanItem(listItem);
  });
}

export class AdminMonitoringService {
  private readonly supabase: Client;

  constructor(client?: Client) {
    this.supabase = client ?? createSupabaseServiceRoleClient();
  }

  private async loadActionPlanPage(
    query: ParsedAdminActionPlanMonitoringQuery,
    page = query.page,
    pageSize = query.pageSize,
    layout = query.layout,
  ): Promise<AdminActionPlanMonitoringResult> {
    const { data, error } = await this.supabase.rpc(
      "get_admin_action_plan_monitoring_page",
      {
        p_organization_id: query.organizationId ?? null,
        p_form_id: query.formId ?? null,
        p_cycle_id: query.cycleId ?? null,
        p_view: query.view ?? null,
        p_search: query.search ?? null,
        p_from: query.from ?? null,
        p_to: query.to ?? null,
        p_card_filter: query.cardFilter ?? null,
        p_layout: layout,
        p_page: page,
        p_page_size: pageSize,
      },
    );
    if (error) throw error;
    const payload = actionPlanPayloadSchema.parse(data);
    return { ...payload, items: mapActionPlanRows(payload.items) };
  }

  private async loadRecommendationPage(
    query: ParsedAdminRecommendationMonitoringQuery,
    page = query.page,
    pageSize = query.pageSize,
    layout = query.layout,
  ): Promise<AdminRecommendationMonitoringResult> {
    const { data, error } = await this.supabase.rpc(
      "get_admin_recommendation_monitoring_page",
      {
        p_organization_id: query.organizationId ?? null,
        p_form_id: query.formId ?? null,
        p_cycle_id: query.cycleId ?? null,
        p_axis_id: query.axisId ?? null,
        p_status: query.status ?? null,
        p_search: query.search ?? null,
        p_from: query.from ?? null,
        p_to: query.to ?? null,
        p_card_filter: query.cardFilter ?? null,
        p_layout: layout,
        p_page: page,
        p_page_size: pageSize,
      },
    );
    if (error) throw error;
    const payload = recommendationPayloadSchema.parse(data);
    return { ...payload, items: mapRecommendationRows(payload.items) };
  }

  async listActionPlans(rawQuery: unknown): Promise<AdminActionPlanMonitoringResult> {
    const query = parseOrThrow(adminActionPlanMonitoringQuerySchema, rawQuery);
    const loadPage: MonitoringPageLoader<AdminActionPlanMonitoringResult> = (
      page,
      pageSize,
      layout,
    ) => this.loadActionPlanPage(query, page, pageSize, layout);
    return query.export
      ? collectMonitoringExport(query, loadPage)
      : loadValidMonitoringPage(loadPage);
  }

  async listRecommendations(rawQuery: unknown): Promise<AdminRecommendationMonitoringResult> {
    const query = parseOrThrow(adminRecommendationMonitoringQuerySchema, rawQuery);
    const loadPage: MonitoringPageLoader<AdminRecommendationMonitoringResult> = (
      page,
      pageSize,
      layout,
    ) => this.loadRecommendationPage(query, page, pageSize, layout);
    return query.export
      ? collectMonitoringExport(query, loadPage)
      : loadValidMonitoringPage(loadPage);
  }

}
