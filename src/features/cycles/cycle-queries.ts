import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { CycleState } from "@/shared/domain/types";
import type { Database } from "@/infrastructure/supabase/database.types";

/**
 * Read model de ciclos (consulta, não escrita).
 *
 * Separado do `CycleStateService` (que é o gatekeeper de transições) porque a
 * responsabilidade é diferente: aqui só lemos a fonte de verdade para
 * dashboards e para resolver qual `cycleId` uma rota deve receber. Tudo lê de
 * `cycles` + tabelas de identidade — nunca de `forms` (594: nenhum número
 * derivado de forms).
 *
 * Enriquece cada ciclo com o que as telas precisam exibir: sigla/nome do órgão,
 * nome e versão do formulário, e a versão de trabalho corrente (o
 * cycle_processing working).
 */

export type CycleListItem = {
  id: string;
  state: CycleState;
  /** Identidade oficial do período compartilhado. */
  periodId: string;
  /** Cache de apresentação (deprecated como identidade). */
  periodLabel: string;
  organizationId: string;
  organizationName: string;
  organizationAcronym: string;
  formId: string;
  formName: string;
  /** Versão imutável congelada pelo ciclo. */
  formVersionId: string;
  formVersion: number;
  reopenCount: number;
  startsAt: string | null;
  responseDeadlineAt: string | null;
  /** Prazo da abertura; prorrogações individuais não o alteram. */
  originalResponseDeadlineAt: string | null;
  validationDeadlineAt: string | null;
  cycleCloseAt: string | null;
  submittedLateAt: string | null;
  submissionDelaySeconds: number | null;
  closedAt: string | null;
  referenceStartYear: number | null;
  referenceEndYear: number | null;
  /** Coleta suspensa administrativamente (não altera cycles.state). */
  responseCollectionPausedAt: string | null;
  deadlineChangeCount: number;
  /** Versão de trabalho corrente (processing working), se houver. */
  workingProcessingId: string | null;
  workingProcessingVersion: number | null;
};

export type CycleListFilters = {
  organizationId?: string;
  formId?: string;
  /** Filtra por um ou mais estados (ex.: dashboard "em andamento"). */
  states?: CycleState[];
  /** Filtro oficial por período compartilhado. */
  periodId?: string;
  /** Compat de leitura; preferir periodId. */
  periodLabel?: string;
};

export type CycleListPageFilters = CycleListFilters & {
  search?: string;
  dueFilter?: "all" | "overdue" | "in_response";
  limit: number;
  offset: number;
};

export type CycleListPage = {
  items: CycleListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type CycleListMetrics = {
  total: number;
  overdue: number;
};

const cycleStateSchema = z.enum([
  "draft", "in_response", "submitted", "in_validation", "awaiting_adjustment", "validated", "completed",
]);
const joinedCycleRowSchema = z.object({
  id: z.string().min(1),
  state: cycleStateSchema,
  period_id: z.string().min(1),
  period_label: z.string(),
  organization_id: z.string().min(1),
  reopen_count: z.number().int().nonnegative(),
  starts_at: z.string().nullable(),
  response_deadline_at: z.string().nullable(),
  original_response_deadline_at: z.string().nullable().optional(),
  validation_deadline_at: z.string().nullable(),
  cycle_close_at: z.string().nullable(),
  submitted_late_at: z.string().nullable(),
  submission_delay_seconds: z.number().int().nonnegative().nullable(),
  closed_at: z.string().nullable(),
  reference_start_year: z.number().int().nullable(),
  reference_end_year: z.number().int().nullable(),
  response_collection_paused_at: z.string().nullable().optional(),
  deadline_change_count: z.number().int().nonnegative().optional(),
  organizations: z.object({ name: z.string(), acronym: z.string() }).nullable(),
  form_versions: z.object({
    id: z.string().min(1),
    version: z.number().int(),
    form_id: z.string().min(1),
    forms: z.object({ name: z.string() }).nullable(),
  }).nullable(),
});
type JoinedCycleRow = z.infer<typeof joinedCycleRowSchema>;
const workingProcessingSchema = z.object({
  id: z.string().min(1),
  cycle_id: z.string().min(1),
  processing_version: z.number().int().positive(),
});

const SELECT_ENRICHED =
  "id, state, period_id, period_label, organization_id, reopen_count, " +
  "starts_at, response_deadline_at, original_response_deadline_at, " +
  "validation_deadline_at, cycle_close_at, " +
  "submitted_late_at, submission_delay_seconds, closed_at, reference_start_year, reference_end_year, " +
  "response_collection_paused_at, deadline_change_count, " +
  "organizations!inner(name, acronym), " +
  "form_versions!inner(id, version, form_id, forms!form_versions_form_id_fkey!inner(name))";

/**
 * Lista ciclos enriquecidos, aplicando filtros opcionais. Por ser um read
 * model, ordena por período desc (mais recente primeiro) — útil para o
 * dashboard e para o admin escolher o ciclo de um período.
 */
export async function listCycles(
  supabase: SupabaseClient,
  filters: CycleListFilters = {},
): Promise<CycleListItem[]> {
  let query = supabase.from("cycles").select(SELECT_ENRICHED);

  if (filters.organizationId) {
    query = query.eq("organization_id", filters.organizationId);
  }
  if (filters.periodId) {
    query = query.eq("period_id", filters.periodId);
  } else if (filters.periodLabel) {
    // Compat temporária: periodLabel não é identidade.
    query = query.eq("period_label", filters.periodLabel);
  }
  if (filters.states && filters.states.length > 0) {
    query = query.in("state", filters.states);
  }
  // O filtro por formId atravessa a relação form_versions.
  if (filters.formId) {
    query = query.eq("form_versions.form_id", filters.formId);
  }

  query = query.order("period_label", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  const rows = z.array(joinedCycleRowSchema).parse(data ?? []);
  if (rows.length === 0) return [];

  // Versões de trabalho (processing working) de todos os ciclos da página,
  // numa única consulta — evita N+1.
  const cycleIds = rows.map((r) => r.id);
  const { data: workingData, error: workingErr } = await supabase
    .from("cycle_processings")
    .select("id, cycle_id, processing_version")
    .in("cycle_id", cycleIds)
    .eq("status", "working");
  if (workingErr) throw workingErr;

  const workingByCycle = new Map<
    string,
    { id: string; processing_version: number }
  >();
  for (const w of z.array(workingProcessingSchema).parse(workingData ?? [])) {
    workingByCycle.set(w.cycle_id, {
      id: w.id,
      processing_version: w.processing_version,
    });
  }

  return rows.map((r) => mapJoined(r, workingByCycle.get(r.id) ?? null));
}

function mapJoined(
  r: JoinedCycleRow,
  working: { id: string; processing_version: number } | null,
): CycleListItem {
  return {
    id: r.id,
    state: r.state,
    periodId: r.period_id,
    periodLabel: r.period_label,
    organizationId: r.organization_id,
    organizationName: r.organizations?.name ?? "",
    organizationAcronym: r.organizations?.acronym ?? "",
    formId: r.form_versions?.form_id ?? "",
    formName: r.form_versions?.forms?.name ?? "",
    formVersionId: r.form_versions?.id ?? "",
    formVersion: r.form_versions?.version ?? 0,
    reopenCount: r.reopen_count ?? 0,
    startsAt: r.starts_at,
    responseDeadlineAt: r.response_deadline_at,
    originalResponseDeadlineAt: r.original_response_deadline_at ?? null,
    validationDeadlineAt: r.validation_deadline_at,
    cycleCloseAt: r.cycle_close_at,
    submittedLateAt: r.submitted_late_at,
    submissionDelaySeconds: r.submission_delay_seconds,
    closedAt: r.closed_at,
    referenceStartYear: r.reference_start_year,
    referenceEndYear: r.reference_end_year,
    responseCollectionPausedAt: r.response_collection_paused_at ?? null,
    deadlineChangeCount: r.deadline_change_count ?? 0,
    workingProcessingId: working?.id ?? null,
    workingProcessingVersion: working?.processing_version ?? null,
  };
}

/**
 * Read model paginado para a tela administrativa. Filtros, ordenação, contagem
 * e recorte são executados no PostgreSQL; o servidor recebe apenas a página.
 */
export async function listCyclesPage(
  supabase: SupabaseClient,
  filters: CycleListPageFilters,
): Promise<CycleListPage> {
  const { data, error } = await supabase.rpc("list_cycles_page", {
    p_search: filters.search?.trim() || null,
    p_organization_id: filters.organizationId ?? null,
    p_form_id: filters.formId ?? null,
    p_states: filters.states?.length ? filters.states : null,
    p_period_label: filters.periodLabel?.trim() || null,
    p_due_filter: filters.dueFilter ?? "all",
    p_limit: filters.limit,
    p_offset: filters.offset,
  });
  if (error) throw error;
  type RpcRow = Database["public"]["Functions"]["list_cycles_page"]["Returns"][number];
  const rows = (data ?? []) as RpcRow[];
  return {
    items: rows.map((row) => ({
      id: row.id,
      state: row.state,
      periodId: "",
      periodLabel: row.period_label,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      organizationAcronym: row.organization_acronym,
      formId: row.form_id,
      formName: row.form_name,
      formVersionId: row.form_version_id,
      formVersion: row.form_version,
      reopenCount: row.reopen_count,
      startsAt: row.starts_at,
      responseDeadlineAt: row.response_deadline_at,
      originalResponseDeadlineAt: null,
      validationDeadlineAt: row.validation_deadline_at,
      cycleCloseAt: row.cycle_close_at,
      submittedLateAt: row.submitted_late_at,
      submissionDelaySeconds: row.submission_delay_seconds,
      closedAt: row.closed_at,
      referenceStartYear: row.reference_start_year,
      referenceEndYear: row.reference_end_year,
      responseCollectionPausedAt: null,
      deadlineChangeCount: 0,
      workingProcessingId: row.working_processing_id,
      workingProcessingVersion: row.working_processing_version,
    })),
    total: Number(rows[0]?.total_count ?? 0),
    limit: filters.limit,
    offset: filters.offset,
  };
}

export async function getCycleListMetrics(
  supabase: SupabaseClient,
  filters: Omit<CycleListPageFilters, "limit" | "offset">,
): Promise<CycleListMetrics> {
  const { data, error } = await supabase.rpc("get_cycle_metrics", {
    p_search: filters.search?.trim() || null,
    p_organization_id: filters.organizationId ?? null,
    p_form_id: filters.formId ?? null,
    p_states: filters.states?.length ? filters.states : null,
    p_period_label: filters.periodLabel?.trim() || null,
    p_due_filter: filters.dueFilter ?? "all",
  });
  if (error) throw error;
  const row = data?.[0];
  return { total: Number(row?.total ?? 0), overdue: Number(row?.overdue ?? 0) };
}

/**
 * Resolve UM ciclo enriquecido por id, ou null. Atalho de leitura para telas de
 * detalhe (a escrita continua passando pelo CycleStateService).
 */
export async function getCycleDetail(
  supabase: SupabaseClient,
  cycleId: string,
): Promise<CycleListItem | null> {
  const { data, error } = await supabase
    .from("cycles")
    .select(SELECT_ENRICHED)
    .eq("id", cycleId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = joinedCycleRowSchema.parse(data);
  const { data: working } = await supabase
    .from("cycle_processings")
    .select("id, processing_version")
    .eq("cycle_id", cycleId)
    .eq("status", "working")
    .maybeSingle();

  return mapJoined(
    row,
    working
      ? z.object({ id: z.string().min(1), processing_version: z.number().int().positive() }).parse(working)
      : null,
  );
}
