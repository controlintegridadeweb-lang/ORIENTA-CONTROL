import {
  createSupabaseServiceRoleClient,
  type TypedSupabaseClient,
} from "@/infrastructure/supabase/server";
import {
  listFormFilterOptions,
  listOrganizationFilterOptions,
  listRecommendationTypeOptions,
} from "@/features/admin/server";
import type { AppRole } from "@/infrastructure/api/auth";
import {
  DomainNotFoundError,
} from "@/infrastructure/api/domain-errors";
import {
  fetchRecommendationById,
  type MappedRecommendationRow,
} from "./cycle-read-model";
import type { RecommendationStatus } from "./schemas";
import type { RecommendationFilterOptions } from "./filter-options";

export type { RecommendationFilterOptions } from "./filter-options";

type Client = TypedSupabaseClient;
type FilterCaller = { role: AppRole; organizationId: string | null };

export class RecommendationsNotFoundError extends DomainNotFoundError {
  constructor(message = "Recomendação não encontrada.") {
    super(message);
    this.name = "RecommendationsNotFoundError";
  }
}

export type RecommendationListItem = {
  id: string;
  cycleId: string;
  formId: string;
  formName: string;
  formVersion: number;
  organizationId: string;
  organizationName: string;
  questionId: string;
  questionPrompt: string;
  sectionName: string;
  axisName: string;
  recommendationType: string;
  originalText: string;
  currentText: string;
  status: RecommendationStatus;
  createdAt: string;
  updatedAt: string;
  hasActionPlan: boolean;
};

/**
 * Leitura administrativa de recomendações e opções de filtro.
 * O texto permanece congelado; alterações operacionais ocorrem no plano de ação.
 */
export class RecommendationsAdminService {
  private supabase: Client;

  constructor(client?: Client) {
    this.supabase = client ?? createSupabaseServiceRoleClient();
  }

  async get(recommendationId: string): Promise<RecommendationListItem> {
    const row = await fetchRecommendationById(this.supabase, recommendationId);
    if (!row) throw new RecommendationsNotFoundError();
    return toListItem(row);
  }

  async listFilterOptions(caller: FilterCaller): Promise<RecommendationFilterOptions> {
    const statuses: RecommendationStatus[] = [
      "generated",
      "in_action_plan",
      "adjustment_requested",
      "exception_requested",
      "awaiting_approval",
      "completed",
      "dismissed",
    ];

    if (caller.role === "respondent") {
      if (!caller.organizationId) {
        return { forms: [], organizations: [], axes: [], types: [], statuses };
      }
      const { data, error } = await this.supabase
        .from("organizations")
        .select("id, name")
        .eq("id", caller.organizationId)
        .maybeSingle();
      if (error) throw error;
      return {
        forms: [],
        organizations: data ? [data as { id: string; name: string }] : [],
        axes: [],
        types: [],
        statuses,
      };
    }

    const [axesResult, forms, organizations, types] = await Promise.all([
      this.supabase.from("axes").select("id, name").order("name", { ascending: true }),
      listFormFilterOptions(this.supabase),
      listOrganizationFilterOptions(this.supabase),
      listRecommendationTypeOptions(this.supabase),
    ]);
    if (axesResult.error) throw axesResult.error;

    return {
      forms,
      organizations: organizations.map(({ id, name }) => ({ id, name })),
      axes: (axesResult.data ?? []).map(({ id, name }) => ({ id, name })),
      types,
      statuses,
    };
  }



}

function toListItem(row: MappedRecommendationRow): RecommendationListItem {
  return {
    id: row.id,
    cycleId: row.cycleId,
    formId: row.formId,
    formName: row.formName,
    formVersion: row.formVersion,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    questionId: row.questionId,
    questionPrompt: row.questionPrompt,
    sectionName: row.sectionName,
    axisName: row.axisName,
    recommendationType: row.recommendationType,
    originalText: row.originalText,
    currentText: row.currentText,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    hasActionPlan: row.hasActionPlan,
  };
}
