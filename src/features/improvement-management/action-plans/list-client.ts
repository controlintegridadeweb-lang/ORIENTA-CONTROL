import type { RecommendationStatus } from "@/shared/domain/recommendation-status";
import { buildHeaders, formatError, parseJson } from "@/infrastructure/api/fetch-client";
import { actionPlansListResponseSchema } from "@/features/improvement-management/client-contracts";
import type { ActionPlanListView, PlanStatus } from "./schemas";
import type { ActionPlanListItem, ActionPlansListResult } from "./types";

export type ListActionPlansFilters = {
  cycleId?: string;
  formId?: string;
  organizationId?: string;
  recommendationId?: string;
  view?: ActionPlanListView;
  recommendationStatus?: RecommendationStatus;
  planStatus?: PlanStatus;
  responsibleContains?: string;
  search?: string;
  dueFilter?: "all" | "overdue" | "due_7d";
  limit?: number;
  offset?: number;
};

function actionPlanListParams(filters: ListActionPlansFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.cycleId) params.set("cycleId", filters.cycleId);
  if (filters.formId) params.set("formId", filters.formId);
  if (filters.organizationId) params.set("organizationId", filters.organizationId);
  if (filters.recommendationId) params.set("recommendationId", filters.recommendationId);
  if (filters.view) params.set("view", filters.view);
  if (filters.recommendationStatus) params.set("recommendationStatus", filters.recommendationStatus);
  if (filters.planStatus) params.set("planStatus", filters.planStatus);
  if (filters.responsibleContains) params.set("responsibleContains", filters.responsibleContains);
  if (filters.search) params.set("search", filters.search);
  if (filters.dueFilter && filters.dueFilter !== "all") params.set("dueFilter", filters.dueFilter);
  if (typeof filters.limit === "number") params.set("limit", String(filters.limit));
  if (typeof filters.offset === "number") params.set("offset", String(filters.offset));
  return params;
}

async function listActionPlansEndpoint(
  endpoint: string,
  filters: ListActionPlansFilters = {},
): Promise<ActionPlansListResult> {
  const query = actionPlanListParams(filters).toString();
  const res = await fetch(`${endpoint}${query ? `?${query}` : ""}`, {
    headers: buildHeaders(),
  });
  const body = await parseJson(res, actionPlansListResponseSchema);
  if (!res.ok || !Array.isArray(body.items)) throw new Error(formatError(body));
  return body;
}

/** Lista planos e recomendações apenas do órgão do respondente autenticado. */
export function listRespondentActionPlans(
  filters: ListActionPlansFilters = {},
): Promise<ActionPlansListResult> {
  return listActionPlansEndpoint("/api/respondent/action-plans", filters);
}

/** Lista administrativa canônica com o mesmo contrato de leitura. */
export function listAdminActionPlans(
  filters: ListActionPlansFilters = {},
): Promise<ActionPlansListResult> {
  return listActionPlansEndpoint("/api/admin/action-plans", filters);
}

/** Carrega integralmente um diagnóstico para formar o read model agregado por seção. */
export async function listAllActionPlansForCycle(
  role: "admin" | "respondent",
  cycleId: string,
): Promise<ActionPlanListItem[]> {
  const pageSize = 200;
  const items: ActionPlanListItem[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await (role === "admin" ? listAdminActionPlans : listRespondentActionPlans)({
      cycleId,
      view: "overview",
      limit: pageSize,
      offset,
    });
    items.push(...page.items);
    if (items.length >= page.total || page.items.length < pageSize) break;
  }
  return items;
}
