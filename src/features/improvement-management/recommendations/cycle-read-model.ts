import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  deriveRecommendationStatus,
  type DerivedRecommendationStatus,
} from "@/shared/domain/recommendation-status";
import type { RecommendationStatus } from "./schemas";
import { chunkValues, collectPostgrestPages } from "@/infrastructure/supabase/pagination";

type ActionPlanJoin = { id: string; status: string };

type OrganizationJoin = { id: string; name: string };
type FormJoin = { id: string; name: string };
type CycleJoin = {
  organization_id: string;
  state: string;
  organizations: OrganizationJoin | OrganizationJoin[];
  form_versions: {
    version: number;
    form_id: string;
    forms: FormJoin | FormJoin[];
  };
};
type QuestionVersionJoin = {
  question_id: string;
  prompt: string;
  section_name: string;
  axis_name: string;
};

export type RecommendationJoinedRow = {
  id: string;
  cycle_id: string;
  cycle_processing_id: string;
  question_version_id: string;
  tipo: string;
  text: string;
  source?: string | null;
  origin?: Record<string, unknown> | null;
  created_at: string;
  cycles: CycleJoin;
  question_versions: QuestionVersionJoin;
  action_plans?: ActionPlanJoin | ActionPlanJoin[] | null;
};
const waiverJoinRowSchema = z.object({
  organization_id: z.string().min(1),
  question_id: z.string().min(1),
});
const waiverSnapshotRowSchema = z.object({
  cycle_processing_id: z.string().min(1),
  question_id: z.string().min(1),
});

export type MappedRecommendationRow = {
  id: string;
  formId: string;
  formName: string;
  formVersion: number;
  organizationId: string;
  organizationName: string;
  /** Estado do diagnóstico que define se o plano de integridade e compliance já pode existir. */
  cycleId: string;
  cycleState: string;
  questionId: string;
  questionPrompt: string;
  sectionName: string;
  axisName: string;
  recommendationType: string;
  /** Origem: quem gerou e o gatilho exato (rastreabilidade). */
  source: string;
  trigger: string | null;
  originMode: string | null;
  originalText: string;
  currentText: string;
  status: RecommendationStatus;
  derivedStatus: DerivedRecommendationStatus;
  createdAt: string;
  updatedAt: string;
  hasActionPlan: boolean;
};

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeActionPlans(raw: unknown): ActionPlanJoin[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as ActionPlanJoin[];
  return [raw as ActionPlanJoin];
}

/** A situação derivada é a mesma exibida pela interface. */
export function toRecommendationStatus(
  derived: DerivedRecommendationStatus,
): RecommendationStatus {
  return derived;
}

export function mapRecommendationRow(
  row: RecommendationJoinedRow,
  waivedQuestionIds: Set<string>,
): MappedRecommendationRow {
  const cycle = row.cycles;
  const org = pickOne(cycle.organizations);
  const fv = cycle.form_versions;
  const form = pickOne(fv.forms);
  const qv = row.question_versions;
  const plans = normalizeActionPlans(row.action_plans);
  const waived = waivedQuestionIds.has(qv.question_id);
  const derived = deriveRecommendationStatus(plans, waived);
  const displayText = row.text;

  return {
    id: row.id,
    formId: fv.form_id,
    formName: form?.name ?? "(formulário removido)",
    formVersion: fv.version ?? 0,
    organizationId: cycle.organization_id,
    organizationName: org?.name ?? "(org removida)",
    cycleId: row.cycle_id,
    cycleState: cycle.state,
    questionId: qv.question_id,
    questionPrompt: qv.prompt ?? "(pergunta removida)",
    sectionName: qv.section_name ?? "",
    axisName: qv.axis_name ?? "",
    recommendationType: row.tipo,
    source: row.source ?? "engine",
    trigger:
      row.origin && typeof row.origin === "object"
        ? ((row.origin.trigger as string | undefined) ?? null)
        : null,
    originMode:
      row.origin && typeof row.origin === "object"
        ? ((row.origin.mode as string | undefined) ?? null)
        : null,
    originalText: displayText,
    currentText: displayText,
    status: toRecommendationStatus(derived),
    derivedStatus: derived,
    createdAt: row.created_at,
    updatedAt: row.created_at,
    hasActionPlan: plans.length > 0,
  };
}

export async function loadWaivedQuestionIds(
  client: SupabaseClient,
  organizationIds: string[],
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  if (organizationIds.length === 0) return map;

  for (const organizationChunk of chunkValues([...new Set(organizationIds)])) {
    const data = await collectPostgrestPages((from, to) =>
      client
        .from("question_organization_waivers")
        .select("organization_id, question_id")
        .in("organization_id", organizationChunk)
        .order("organization_id", { ascending: true })
        .order("question_id", { ascending: true })
        .range(from, to),
    );

    for (const row of z.array(waiverJoinRowSchema).parse(data)) {
      const orgId = row.organization_id;
      const qId = row.question_id;
      const set = map.get(orgId) ?? new Set<string>();
      set.add(qId);
      map.set(orgId, set);
    }
  }
  return map;
}

export async function loadHistoricalWaivedQuestionIds(
  client: SupabaseClient,
  cycleProcessingIds: string[],
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  if (cycleProcessingIds.length === 0) return map;

  for (const processingChunk of chunkValues([...new Set(cycleProcessingIds)])) {
    const data = await collectPostgrestPages((from, to) =>
      client
        .from("processing_waiver_snapshots")
        .select("cycle_processing_id, question_id")
        .in("cycle_processing_id", processingChunk)
        .order("cycle_processing_id", { ascending: true })
        .order("question_id", { ascending: true })
        .range(from, to),
    );
    for (const row of z.array(waiverSnapshotRowSchema).parse(data)) {
      const ids = map.get(row.cycle_processing_id) ?? new Set<string>();
      ids.add(row.question_id);
      map.set(row.cycle_processing_id, ids);
    }
  }
  return map;
}

export type RecommendationQueryFilters = {
  /** Escopo operacional exato. Quando presente, prevalece sobre filtros agregados. */
  cycleId?: string;
  organizationId?: string;
  formId?: string;
  recommendationId?: string;
  axisId?: string;
  status?: RecommendationStatus;
  type?: string;
  limit: number;
  offset: number;
};

export type RecommendationQueryResult = {
  items: MappedRecommendationRow[];
  total: number;
};

export async function queryRecommendations(
  client: SupabaseClient,
  filters: RecommendationQueryFilters,
): Promise<RecommendationQueryResult> {
  const { data, error } = await client.rpc("list_recommendations_page", {
    p_cycle_id: filters.cycleId ?? null,
    p_organization_id: filters.organizationId ?? null,
    p_form_id: filters.formId ?? null,
    p_recommendation_id: filters.recommendationId ?? null,
    p_axis_id: filters.axisId ?? null,
    p_status: filters.status ?? null,
    p_type: filters.type ?? null,
    p_limit: filters.limit,
    p_offset: filters.offset,
  });
  if (error) throw error;

  const rowSchema = z.object({
    recommendation_id: z.string().min(1),
    cycle_id: z.string().min(1),
    cycle_processing_id: z.string().min(1),
    form_id: z.string().min(1),
    form_name: z.string(),
    form_version: z.number(),
    organization_id: z.string().min(1),
    organization_name: z.string(),
    cycle_state: z.string(),
    question_id: z.string().min(1),
    question_prompt: z.string(),
    section_name: z.string(),
    axis_name: z.string(),
    recommendation_type: z.string(),
    source: z.string(),
    trigger: z.string().nullable(),
    origin_mode: z.string().nullable(),
    recommendation_text: z.string(),
    recommendation_status: z.enum([
      "generated", "in_action_plan", "awaiting_approval", "adjustment_requested",
      "exception_requested", "completed", "dismissed",
    ]),
    created_at: z.string(),
    has_action_plan: z.boolean(),
    total_count: z.number(),
  });
  const rows = z.array(rowSchema).parse(data ?? []);
  return {
    total: Number(rows[0]?.total_count ?? 0),
    items: rows.map((row) => ({
      id: row.recommendation_id,
      formId: row.form_id,
      formName: row.form_name,
      formVersion: row.form_version,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      cycleId: row.cycle_id,
      cycleState: row.cycle_state,
      questionId: row.question_id,
      questionPrompt: row.question_prompt,
      sectionName: row.section_name,
      axisName: row.axis_name,
      recommendationType: row.recommendation_type,
      source: row.source,
      trigger: row.trigger,
      originMode: row.origin_mode,
      originalText: row.recommendation_text,
      currentText: row.recommendation_text,
      status: row.recommendation_status,
      derivedStatus: row.recommendation_status,
      createdAt: row.created_at,
      updatedAt: row.created_at,
      hasActionPlan: row.has_action_plan,
    })),
  };
}

export async function fetchRecommendationById(
  client: SupabaseClient,
  recommendationId: string,
): Promise<MappedRecommendationRow | null> {
  const { items } = await queryRecommendations(client, {
    recommendationId,
    limit: 1,
    offset: 0,
  });
  return items[0] ?? null;
}

export type RecommendationPendencyRow = {
  id: string;
  text: string;
  status: RecommendationStatus;
};

/** Recomendações geradas sem ação cadastrada — para pendências do dashboard admin. */
export async function loadOpenRecommendationsWithoutPlan(
  client: SupabaseClient,
  organizationId?: string,
  limit = 8,
): Promise<{ items: RecommendationPendencyRow[]; total: number }> {
  const { data, error } = await client.rpc("list_open_recommendations_without_plan", {
    p_organization_id: organizationId ?? null,
    p_limit: limit,
    p_offset: 0,
  });
  if (error) throw error;
  const rows = z.array(z.object({
    id: z.string().min(1),
    text: z.string(),
    status: z.enum([
      "generated", "in_action_plan", "awaiting_approval", "adjustment_requested",
      "exception_requested", "completed", "dismissed",
    ]),
    total_count: z.number(),
  })).parse(data ?? []);
  return {
    total: Number(rows[0]?.total_count ?? 0),
    items: rows.map((row) => ({ id: row.id, text: row.text, status: row.status })),
  };
}
