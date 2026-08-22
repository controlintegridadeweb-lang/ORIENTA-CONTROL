import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { FormsValidationError } from "./admin-service";
import { loadFormBasic } from "./answers-queries";
import { getRespondentDetail } from "./respondent-detail";
import {
  RESPONDENT_LIST_DEFAULT_LIMIT,
  RESPONDENT_LIST_MAX_LIMIT,
  RESPONDENT_STATUS_VALUES,
  type AnswersListQuery,
  type AnswersOverview,
  type AnswersSummary,
  type RespondentDetail,
  type RespondentFilterOptions,
  type RespondentListCursor,
  type RespondentListPage,
  type RespondentRow,
  type RespondentStatus,
} from "./answers-types";

type Client = SupabaseClient;

const respondentStatusSchema = z.enum([
  "nao_iniciada",
  "em_preenchimento",
  "completa",
  "submetida",
  "em_complementacao",
]);

const overviewSchema: z.ZodType<AnswersOverview> = z.object({
  formId: z.string().uuid(),
  formName: z.string(),
  totalRespondents: z.number().int().nonnegative(),
  totalCycles: z.number().int().nonnegative(),
  totalQuestions: z.number().int().nonnegative(),
  lastAnswerAt: z.string().nullable(),
  statusBreakdown: z.object({
    nao_iniciada: z.number().int().nonnegative(),
    em_preenchimento: z.number().int().nonnegative(),
    completa: z.number().int().nonnegative(),
    submetida: z.number().int().nonnegative(),
    em_complementacao: z.number().int().nonnegative(),
  }),
});

const summarySchema: z.ZodType<AnswersSummary> = z.object({
  formId: z.string().uuid(),
  totalRespondents: z.number().int().nonnegative(),
  questions: z.array(z.object({
    questionId: z.string().uuid(),
    orderIndex: z.number().int().nonnegative(),
    prompt: z.string(),
    answerType: z.literal("yes_no"),
    totalResponses: z.number().int().nonnegative(),
    distribution: z.object({
      yes: z.number().int().nonnegative(),
      no: z.number().int().nonnegative(),
      not_applicable: z.number().int().nonnegative(),
    }),
  })),
});

const respondentPageRowSchema = z.object({
  cycle_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  organization_name: z.string(),
  period_label: z.string(),
  answered_questions: z.number().int().nonnegative(),
  total_questions: z.number().int().nonnegative(),
  last_updated_at: z.string(),
  respondent_status: respondentStatusSchema,
  contributor_count: z.number().int().nonnegative(),
});

/**
 * Serviço de leitura/agregação para a aba “Respostas” de Formulários.
 * Listagem, indicadores e distribuição são calculados no PostgreSQL; a
 * aplicação recebe somente a página ou o agregado solicitado.
 */
export class FormsAnswersService {
  private supabase: Client;

  constructor(client?: Client) {
    this.supabase = client ?? createSupabaseServiceRoleClient();
  }

  async getOverview(formId: string): Promise<AnswersOverview> {
    await loadFormBasic(this.supabase, formId);
    const { data, error } = await this.supabase.rpc("get_form_answers_overview", {
      p_form_id: formId,
    });
    if (error) throw error;
    return overviewSchema.parse(data);
  }

  async getSummary(formId: string): Promise<AnswersSummary> {
    await loadFormBasic(this.supabase, formId);
    const { data, error } = await this.supabase.rpc("get_form_answers_summary", {
      p_form_id: formId,
    });
    if (error) throw error;
    return summarySchema.parse(data);
  }

  async listRespondents(
    formId: string,
    query: AnswersListQuery = {},
  ): Promise<RespondentListPage> {
    await loadFormBasic(this.supabase, formId);
    const limit = Math.min(
      Math.max(query.limit ?? RESPONDENT_LIST_DEFAULT_LIMIT, 1),
      RESPONDENT_LIST_MAX_LIMIT,
    );
    const { data, error } = await this.supabase.rpc(
      "list_form_answer_respondents_page",
      {
        p_form_id: formId,
        p_organization_id: query.organizationId ?? null,
        p_status: query.status ?? null,
        p_from: query.from ?? null,
        p_to: query.to ?? null,
        p_cursor_updated_at: query.cursor?.updatedAt ?? null,
        p_cursor_cycle_id: query.cursor?.cycleId ?? null,
        p_limit: limit,
      },
    );
    if (error) throw error;
    const dbRows = z.array(respondentPageRowSchema).parse(data ?? []);
    const hasMore = dbRows.length > limit;
    const visibleRows = hasMore ? dbRows.slice(0, limit) : dbRows;
    const rows: RespondentRow[] = visibleRows.map((row) => ({
      cycleId: row.cycle_id,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      periodLabel: row.period_label,
      answeredQuestions: row.answered_questions,
      totalQuestions: row.total_questions,
      lastUpdatedAt: row.last_updated_at,
      status: row.respondent_status,
      contributorCount: row.contributor_count,
    }));
    const last = rows.at(-1);
    return {
      rows,
      nextCursor: hasMore && last
        ? { updatedAt: last.lastUpdatedAt, cycleId: last.cycleId }
        : null,
    };
  }

  async listAllRespondentsForExport(
    formId: string,
    filters: AnswersListQuery = {},
  ): Promise<RespondentRow[]> {
    const rows: RespondentRow[] = [];
    let cursor: RespondentListCursor | null = null;

    do {
      const page = await this.listRespondents(formId, {
        ...filters,
        cursor,
        limit: RESPONDENT_LIST_MAX_LIMIT,
      });
      rows.push(...page.rows);
      cursor = page.nextCursor;
    } while (cursor);

    return rows;
  }

  async listFilterOptions(formId: string): Promise<RespondentFilterOptions> {
    await loadFormBasic(this.supabase, formId);
    const { data, error } = await this.supabase.rpc(
      "list_form_answer_organization_options",
      { p_form_id: formId },
    );
    if (error) throw error;
    const organizations = z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
    })).parse(data ?? []);
    return { organizations };
  }

  async getRespondentDetail(cycleId: string): Promise<RespondentDetail> {
    return getRespondentDetail(this.supabase, cycleId);
  }
}

export function parseStatusFilter(raw: string | null): RespondentStatus | null {
  if (!raw) return null;
  if ((RESPONDENT_STATUS_VALUES as readonly string[]).includes(raw)) {
    return raw as RespondentStatus;
  }
  throw new FormsValidationError([
    { path: "status", message: "Situação inválida." },
  ]);
}
