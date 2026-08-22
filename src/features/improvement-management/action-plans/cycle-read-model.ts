import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  toRecommendationStatus,
  loadHistoricalWaivedQuestionIds,
  loadWaivedQuestionIds,
} from "@/features/improvement-management/recommendations/cycle-read-model";
import { deriveRecommendationStatus } from "@/shared/domain/recommendation-status";
import type { RecommendationWithPlansRow } from "@/features/improvement-management/action-plans/domain-model";
import type { RecommendationStatus } from "@/features/improvement-management/recommendations/schemas";
import type { RecommendationRowRaw } from "./types";
import {
  isCurrentOfficialProcessing,
  resolveCurrentOfficialProcessingIds,
} from "@/features/improvement-management/recommendations/current-official-processing";
import { chunkValues, collectPostgrestPages } from "@/infrastructure/supabase/pagination";

const ACTION_PLAN_RECOMMENDATION_SELECT =
  "id, cycle_id, cycle_processing_id, question_version_id, tipo, text, created_at, " +
  "cycles!inner(" +
  "id, period_label, organization_id, state, " +
  "organizations!inner(id, name), " +
  "form_versions!inner(version, form_id, forms!form_versions_form_id_fkey!inner(id, name))" +
  "), " +
  "question_versions!inner(question_id, prompt, section_name, section_order, axis_name, axis_id, section_id), " +
  "action_plans(id, action_text, start_date, due_date, responsible_user_id, responsible_label, progress_percentage, status, execution_notes, updated_at, revision, " +
  "action_plan_documents(id, action_revision, kind, title, external_link, original_filename, mime_type, size_bytes, file_validation_status, validated_at, created_at, deactivated_at))";


const actionPlanJoinedRowSchema = z.object({
  id: z.string().min(1),
  cycle_id: z.string().min(1),
  cycle_processing_id: z.string().min(1),
  tipo: z.string(),
  text: z.string(),
  created_at: z.string(),
  cycles: z.object({
    id: z.string().min(1),
    period_label: z.string(),
    organization_id: z.string().min(1),
    state: z.string(),
    organizations: z.object({ id: z.string().min(1), name: z.string() }),
    form_versions: z.object({
      version: z.number(),
      form_id: z.string().min(1),
      forms: z.object({ id: z.string().min(1), name: z.string() }),
    }),
  }),
  question_versions: z.object({
    question_id: z.string().min(1),
    prompt: z.string(),
    section_name: z.string(),
    section_order: z.number().int().optional().default(0),
    axis_name: z.string(),
    axis_id: z.string().min(1),
    section_id: z.string().min(1),
  }),
  action_plans: z.unknown().optional(),
});

type ActionPlanJoinedRow = z.infer<typeof actionPlanJoinedRowSchema>;

const currentReadModelRowSchema = z.object({
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
    "generated",
    "in_action_plan",
    "awaiting_approval",
    "adjustment_requested",
    "exception_requested",
    "completed",
    "dismissed",
  ]),
  recommendation_created_at: z.string(),
  action_plans: z.array(z.record(z.string(), z.unknown())),
  total_count: z.number(),
});

async function queryCurrentReadModelRows(
  client: SupabaseClient,
  filters: ActionPlanQueryFilters,
): Promise<RecommendationRowRaw[]> {
  const pageSize = 200;
  const rows: z.infer<typeof currentReadModelRowSchema>[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.rpc("list_action_plan_recommendations_page", {
      p_cycle_id: filters.cycleId ?? null,
      p_organization_id: filters.organizationId ?? null,
      p_form_id: filters.formId ?? null,
      p_recommendation_id: filters.recommendationId ?? null,
      p_view: "overview",
      p_recommendation_status: null,
      p_plan_status: null,
      p_responsible_contains: null,
      p_search: null,
      p_due_filter: "all",
      p_limit: pageSize,
      p_offset: offset,
    });
    if (error) throw error;
    const page = z.array(currentReadModelRowSchema).parse(data ?? []);
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows.map((row) => ({
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
    action_plans: row.action_plans as RecommendationRowRaw["action_plans"],
    created_at: row.recommendation_created_at,
  }));
}

const recommendationScopeRowSchema = z.object({
  id: z.string().min(1),
  cycle_id: z.string().min(1),
  cycle_processing_id: z.string().min(1),
  question_versions: z.object({
    question_id: z.string().min(1),
    axis_id: z.string().min(1),
  }),
  cycles: z.object({
    organization_id: z.string().min(1),
    state: z.string(),
    form_versions: z.object({ form_id: z.string().min(1) }),
  }),
});

export type ActionPlanRecommendationScope = {
  recommendationId: string;
  cycleId: string;
  cycleState: string;
  organizationId: string;
  formId: string;
  questionId: string;
  axisId: string;
};

export type ActionPlanQueryFilters = {
  /** Escopo operacional exato. Consultas administrativas podem usar os filtros agregados. */
  cycleId?: string;
  /** Processamento FAMI imutável usado por relatórios históricos. */
  cycleProcessingId?: string;
  organizationId?: string;
  formId?: string;
  recommendationId?: string;
};

function normalizePlans(raw: unknown): Array<{ status: string }> {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Array<{ status: string }>;
  return [raw as { status: string }];
}

function toRecommendationWithPlansRow(
  row: ActionPlanJoinedRow,
  recommendationStatus: RecommendationStatus,
): RecommendationWithPlansRow {
  const cycle = row.cycles;
  const fv = cycle.form_versions;
  const qv = row.question_versions;
  const rawPlans = row.action_plans;
  const actionPlans = !rawPlans
    ? []
    : Array.isArray(rawPlans)
      ? rawPlans
      : [rawPlans];
  const displayText = row.text;

  return {
    id: row.id,
    form_id: fv.form_id,
    organization_id: cycle.organization_id,
    recommendation_type: row.tipo,
    current_text: displayText,
    status: recommendationStatus,
    question_id: qv.question_id,
    questions: {
      id: qv.question_id,
      prompt: qv.prompt,
      section_id: qv.section_id,
      section_order: qv.section_order,
      sections: {
        name: qv.section_name,
        axes: { id: qv.axis_id, name: qv.axis_name },
      },
    },
    action_plans: actionPlans,
  };
}

function toRecommendationRowRaw(
  row: ActionPlanJoinedRow,
  recommendationStatus: RecommendationStatus,
): RecommendationRowRaw {
  const base = toRecommendationWithPlansRow(row, recommendationStatus);
  const fv = row.cycles.form_versions;
  return {
    ...base,
    cycle_id: row.cycles.id,
    period_label: row.cycles.period_label,
    cycle_state: row.cycles.state,
    axis_id: row.question_versions.axis_id,
    section_order: row.question_versions.section_order,
    forms: { id: fv.form_id, name: fv.forms.name, version: fv.version },
    organizations: {
      id: row.cycles.organization_id,
      name: row.cycles.organizations.name,
    },
    created_at: row.created_at,
  };
}

function mapJoinedRows(
  rows: ActionPlanJoinedRow[],
  liveWaivedByOrg: Map<string, Set<string>>,
  historicalWaivedByProcessing: Map<string, Set<string>>,
): RecommendationRowRaw[] {
  return rows.map((row) => {
    const useHistoricalWaivers =
      row.cycles.state === "validated" || row.cycles.state === "completed";
    const waived = useHistoricalWaivers
      ? (historicalWaivedByProcessing.get(row.cycle_processing_id) ?? new Set<string>())
      : (liveWaivedByOrg.get(row.cycles.organization_id) ?? new Set<string>());
    const plans = normalizePlans(row.action_plans);
    const derived = deriveRecommendationStatus(
      plans,
      waived.has(row.question_versions.question_id),
    );
    const recommendationStatus = toRecommendationStatus(derived);
    return toRecommendationRowRaw(row, recommendationStatus);
  });
}

export async function queryActionPlanRecommendationRows(
  client: SupabaseClient,
  filters: ActionPlanQueryFilters,
): Promise<RecommendationRowRaw[]> {
  if (!filters.cycleProcessingId) {
    return queryCurrentReadModelRows(client, filters);
  }

  if (filters.cycleId && await isCurrentOfficialProcessing(
    client,
    filters.cycleId,
    filters.cycleProcessingId,
  )) {
    return queryCurrentReadModelRows(client, {
      cycleId: filters.cycleId,
      organizationId: filters.organizationId,
      formId: filters.formId,
      recommendationId: filters.recommendationId,
    });
  }

  const officialProcessingIds = filters.cycleProcessingId
    ? null
    : await resolveCurrentOfficialProcessingIds(client, {
      cycleId: filters.cycleId,
      organizationId: filters.organizationId,
      formId: filters.formId,
    });
  if (officialProcessingIds && officialProcessingIds.size === 0) return [];

  const rows: ActionPlanJoinedRow[] = [];
  const processingChunks = officialProcessingIds
    ? chunkValues([...officialProcessingIds])
    : [null];

  for (const processingChunk of processingChunks) {
    const pageRows = await collectPostgrestPages((from, to) => {
      let req = client
        .from("recommendations")
        .select(ACTION_PLAN_RECOMMENDATION_SELECT)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });

      if (processingChunk) req = req.in("cycle_processing_id", processingChunk);
      if (filters.recommendationId) req = req.eq("id", filters.recommendationId);
      if (filters.cycleId) req = req.eq("cycle_id", filters.cycleId);
      if (filters.cycleProcessingId) {
        req = req.eq("cycle_processing_id", filters.cycleProcessingId);
      }
      if (filters.organizationId) {
        req = req.eq("cycles.organization_id", filters.organizationId);
      }
      if (filters.formId) {
        req = req.eq("cycles.form_versions.form_id", filters.formId);
      }

      return req.range(from, to);
    });
    rows.push(...z.array(actionPlanJoinedRowSchema).parse(pageRows));
  }

  rows.sort((a, b) =>
    b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
  );
  const liveRows = rows.filter((row) =>
    row.cycles.state !== "validated" && row.cycles.state !== "completed",
  );
  const historicalProcessingIds = rows
    .filter((row) => row.cycles.state === "validated" || row.cycles.state === "completed")
    .map((row) => row.cycle_processing_id);
  const [liveWaivedByOrg, historicalWaivedByProcessing] = await Promise.all([
    loadWaivedQuestionIds(
      client,
      Array.from(new Set(liveRows.map((row) => row.cycles.organization_id))),
    ),
    loadHistoricalWaivedQuestionIds(client, historicalProcessingIds),
  ]);
  return mapJoinedRows(rows, liveWaivedByOrg, historicalWaivedByProcessing);
}

export async function loadRecommendationScope(
  client: SupabaseClient,
  recommendationId: string,
): Promise<ActionPlanRecommendationScope | null> {
  const { data, error } = await client
    .from("recommendations")
    .select(
      "id, cycle_id, cycle_processing_id, question_versions!inner(question_id, axis_id), " +
        "cycles!inner(organization_id, state, form_versions!inner(form_id))",
    )
    .eq("id", recommendationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = recommendationScopeRowSchema.parse(data);
  const isCurrent = await isCurrentOfficialProcessing(
    client,
    row.cycle_id,
    row.cycle_processing_id,
  );
  if (!isCurrent) return null;

  return {
    recommendationId: row.id,
    cycleId: row.cycle_id,
    cycleState: row.cycles.state,
    organizationId: row.cycles.organization_id,
    formId: row.cycles.form_versions.form_id,
    questionId: row.question_versions.question_id,
    axisId: row.question_versions.axis_id,
  };
}
