import type {
  AdminPlanItem,
  AdminPlanSummary,
} from "@/features/improvement-management/action-plans/admin-monitoring";
import type {
  AdminRecommendationItem,
  AdminRecommendationSummary,
} from "@/features/improvement-management/recommendations/admin-presentation";
import type { RecommendationStatus } from "@/shared/domain/recommendation-status";
import type { AdminPlanView } from "@/features/improvement-management/action-plans/admin-monitoring";

type AdminMonitoringLayout = "list" | "organization";

export type AdminPlanCardFilter = null | "in_progress" | "completed" | "overdue";

export type AdminRecommendationCardFilter =
  | null
  | "without_plan"
  | "executing"
  | "completed"
  | "overdue";

export type AdminActionPlanMonitoringQuery = {
  organizationId?: string;
  formId?: string;
  cycleId?: string;
  view?: "" | AdminPlanView;
  search?: string;
  from?: string;
  to?: string;
  cardFilter?: AdminPlanCardFilter;
  layout?: AdminMonitoringLayout;
  page?: number;
  pageSize?: number;
};

export type AdminRecommendationMonitoringQuery = {
  organizationId?: string;
  formId?: string;
  cycleId?: string;
  axisId?: string;
  status?: "" | RecommendationStatus;
  search?: string;
  from?: string;
  to?: string;
  cardFilter?: AdminRecommendationCardFilter;
  layout?: AdminMonitoringLayout;
  page?: number;
  pageSize?: number;
};

type AdminMonitoringResult<TItem, TSummary> = {
  items: TItem[];
  summary: TSummary;
  /** Total de registros após filtros e filtro de card. */
  total: number;
  /** Total paginável: registros na lista ou organizações na visão agrupada. */
  paginationTotal: number;
  page: number;
  pageSize: number;
  totalPages: number;
  layout: AdminMonitoringLayout;
  selectedCycleLabel: string | null;
};

export type AdminActionPlanMonitoringResult = AdminMonitoringResult<
  AdminPlanItem,
  AdminPlanSummary
>;

export type AdminRecommendationMonitoringResult = AdminMonitoringResult<
  AdminRecommendationItem,
  AdminRecommendationSummary
>;
