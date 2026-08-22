import type { ZodType } from "zod";
import {
  createSupabaseServiceRoleClient,
  type TypedSupabaseClient,
} from "@/infrastructure/supabase/server";
import {
  listFormFilterOptions,
  listOrganizationFilterOptions,
} from "@/features/admin/server";
import type { AppRole } from "@/infrastructure/api/auth";
import { isGlobalAdmin } from "@/infrastructure/auth/scope";
import {
  loadEvidenceMetrics,
  loadHydratedEvidences,
  loadHydratedEvidencesPage,
} from "./cycle-read-model";
import { DomainValidationError } from "@/infrastructure/api/domain-errors";
import { aggregateKpiCounts } from "./status-groups";
import type {
  EvidenceFilterOptions,
  EvidenceListItem,
  EvidenceStatsResult,
  EvidencesListResult,
} from "./types";

export type {
  EvidenceFilterOptions,
  EvidenceListItem,
  EvidenceStatsResult,
  EvidencesListResult,
} from "./types";

import {
  evidenceExportFiltersSchema,
  evidenceStatsQuerySchema,
  listEvidencesQuerySchema,
  type ListEvidencesQuery,
  type ValidationStatus,
} from "./schemas";

// -- Tipos de saída --------------------------------------------------------

type OrgRow = { id: string; name: string };
type Client = TypedSupabaseClient;
type Caller = { role: AppRole; organizationId: string | null };
const MAX_EVIDENCE_EXPORT_ITEMS = 5_000;
const EVIDENCE_EXPORT_PAGE_SIZE = 200;

/**
 * Escopo da tela admin de evidências: só itens já submetidos à análise.
 * O status `pending` (aguardando envio) continua no fluxo do respondente.
 */
function applyAdminValidationQueueScope<
  T extends { status?: ValidationStatus; excludeStatus?: ValidationStatus },
>(query: T, caller: Caller): T {
  if (caller.role !== "admin") return query;
  if (query.status === "pending") {
    return { ...query, status: undefined, excludeStatus: "pending" };
  }
  if (query.status || query.excludeStatus) return query;
  return { ...query, excludeStatus: "pending" };
}

function toAdminQueueStats(metrics: EvidenceStatsResult): EvidenceStatsResult {
  return {
    total:
      metrics.aguardando_validacao +
      metrics.ajuste_solicitado +
      metrics.aprovadas +
      metrics.nao_aprovadas,
    aguardando_envio: 0,
    aguardando_validacao: metrics.aguardando_validacao,
    ajuste_solicitado: metrics.ajuste_solicitado,
    aprovadas: metrics.aprovadas,
    nao_aprovadas: metrics.nao_aprovadas,
  };
}

/**
 * Serviço operacional para a aba de evidências do admin (cycle-cêntrico).
 *
 * O veredito atual vive embutido em `evidences.validation_status`; o histórico
 * completo está em audit_logs. A listagem resolve escopo via response → cycle.
 */
export class EvidencesAdminService {
  protected supabase: Client;

  constructor(client?: Client) {
    this.supabase = client ?? createSupabaseServiceRoleClient();
  }

  // -- Listagem ----------------------------------------------------------

  async list(rawQuery: unknown, caller: Caller): Promise<EvidencesListResult> {
    const query = applyAdminValidationQueueScope(
      this.parse(listEvidencesQuerySchema, rawQuery),
      caller,
    );
    const effectiveOrgId = this.resolveEffectiveOrganizationId(
      caller,
      query.organizationId,
    );
    if (effectiveOrgId === null) {
      return { items: [], total: 0, limit: query.limit, offset: query.offset };
    }

    const page = await loadHydratedEvidencesPage(
      this.supabase,
      {
        search: query.search,
        status: query.status,
        excludeStatus: query.excludeStatus,
        pendingOnly: query.pendingOnly,
        organizationId: effectiveOrgId,
        cycleId: query.cycleId,
        formId: query.formId,
        questionId: query.questionId,
        from: query.from,
        to: query.to,
        axisName: query.axisName,
        sectionName: query.sectionName,
        ids: query.ids,
      },
      query.limit,
      query.offset,
    );
    return { ...page, limit: query.limit, offset: query.offset };
  }

  /**
   * Conjunto completo depois dos filtros, antes da paginação. Serviços de
   * respondente usam este contrato para aplicar filtros derivados de status
   * sem perder itens das páginas seguintes.
   */
  async listFiltered(
    rawQuery: unknown,
    caller: Caller,
  ): Promise<EvidenceListItem[]> {
    const query = applyAdminValidationQueueScope(
      this.parse(listEvidencesQuerySchema, rawQuery),
      caller,
    );
    const base = await this.loadHydratedItems(caller, query);
    const narrowed = this.applyEvidenceQueryFilters(base, query);
    const byStatus = query.status
      ? narrowed.filter((item) => item.currentStatus === query.status)
      : narrowed;
    return query.excludeStatus
      ? byStatus.filter((item) => item.currentStatus !== query.excludeStatus)
      : byStatus;
  }

  async getStats(
    rawQuery: unknown,
    caller: Caller,
  ): Promise<EvidenceStatsResult> {
    const query = this.parse(evidenceStatsQuerySchema, rawQuery);
    const effectiveOrgId = this.resolveEffectiveOrganizationId(
      caller,
      query.organizationId,
    );
    if (effectiveOrgId === null) return aggregateKpiCounts([]);
    const metrics = await loadEvidenceMetrics(this.supabase, {
      search: query.search,
      status: query.status,
      pendingOnly: query.pendingOnly,
      organizationId: effectiveOrgId,
      cycleId: query.cycleId,
      formId: query.formId,
      questionId: query.questionId,
      from: query.from,
      to: query.to,
      axisName: query.axisName,
      sectionName: query.sectionName,
      ids: query.ids,
    });
    return caller.role === "admin" ? toAdminQueueStats(metrics) : metrics;
  }

  /** Lista completa para exportação CSV/PDF, respeitando todos os filtros. */
  async listForExport(
    rawQuery: unknown,
    caller: Caller,
  ): Promise<EvidenceListItem[]> {
    const query = applyAdminValidationQueueScope(
      this.parse(evidenceExportFiltersSchema, rawQuery),
      caller,
    );
    const effectiveOrgId = this.resolveEffectiveOrganizationId(
      caller,
      query.organizationId,
    );
    if (effectiveOrgId === null) return [];

    const filters = {
      search: query.search,
      status: query.status,
      excludeStatus: query.excludeStatus,
      pendingOnly: query.pendingOnly,
      organizationId: effectiveOrgId,
      cycleId: query.cycleId,
      formId: query.formId,
      questionId: query.questionId,
      from: query.from,
      to: query.to,
      axisName: query.axisName,
      sectionName: query.sectionName,
      ids: query.ids,
    };
    const first = await loadHydratedEvidencesPage(
      this.supabase,
      filters,
      EVIDENCE_EXPORT_PAGE_SIZE,
      0,
    );
    if (first.total > MAX_EVIDENCE_EXPORT_ITEMS) {
      throw new DomainValidationError(
        [{
          path: "filters",
          message: `A exportação excede ${MAX_EVIDENCE_EXPORT_ITEMS} evidências. Aplique filtros mais específicos.`,
        }],
        `A exportação excede ${MAX_EVIDENCE_EXPORT_ITEMS} evidências.`,
      );
    }

    const items = [...first.items];
    while (items.length < first.total) {
      const page = await loadHydratedEvidencesPage(
        this.supabase,
        filters,
        EVIDENCE_EXPORT_PAGE_SIZE,
        items.length,
      );
      if (page.items.length === 0) break;
      items.push(...page.items);
    }
    return items;
  }

  /**
   * Mesma estrategia 1-2-3 do list(): evidencias + validacoes + metadados.
   * Aplica apenas filtros de fato (org/form) vindos da query ou do perfil.
   */
  protected async loadHydratedItems(
    caller: Caller,
    query: Pick<
      ListEvidencesQuery,
      | "cycleId"
      | "questionId"
      | "formId"
      | "organizationId"
      | "from"
      | "to"
      | "axisName"
      | "sectionName"
      | "ids"
    >,
  ): Promise<EvidenceListItem[]> {
    if (!isGlobalAdmin(caller) && !caller.organizationId) {
      return [];
    }

    const effectiveOrgId = this.resolveEffectiveOrganizationId(
      caller,
      query.organizationId,
    );

    const items = await loadHydratedEvidences(this.supabase, {
      organizationId: effectiveOrgId ?? undefined,
      cycleId: query.cycleId,
      formId: query.formId,
      questionId: query.questionId,
      from: query.from,
      to: query.to,
      axisName: query.axisName,
      sectionName: query.sectionName,
      ids: query.ids,
    });
    return items;
  }

  private resolveEffectiveOrganizationId(
    caller: Caller,
    requestedOrganizationId?: string,
  ): string | undefined | null {
    if (isGlobalAdmin(caller)) return requestedOrganizationId;
    return caller.organizationId ?? null;
  }

  protected applyEvidenceQueryFilters(
    items: EvidenceListItem[],
    query: Pick<
      ListEvidencesQuery,
      "search" | "from" | "to" | "axisName" | "sectionName" | "ids"
    >,
  ): EvidenceListItem[] {
    let out = items;
    if (query.ids && query.ids.length > 0) {
      const allowed = new Set(query.ids);
      out = out.filter((i) => allowed.has(i.id));
    }
    if (query.search) {
      const needle = query.search.toLowerCase();
      out = out.filter((i) => {
        const blob = [
          i.title,
          i.description,
          i.textBody,
          i.questionPrompt,
          i.axisName,
          i.sectionName,
          i.formName,
          i.organizationName,
          i.submittedBy,
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(needle);
      });
    }
    if (query.from) {
      const fromMs = new Date(query.from).getTime();
      out = out.filter((i) => new Date(i.submittedAt).getTime() >= fromMs);
    }
    if (query.to) {
      const toMs = new Date(query.to).getTime();
      out = out.filter((i) => new Date(i.submittedAt).getTime() <= toMs);
    }
    if (query.axisName) {
      out = out.filter((i) => i.axisName.trim() === query.axisName);
    }
    if (query.sectionName) {
      out = out.filter((i) => i.sectionName.trim() === query.sectionName);
    }
    return out;
  }

  // -- Filtros -----------------------------------------------------------

  async listFilterOptions(caller: Caller): Promise<EvidenceFilterOptions> {
    const forms = await listFormFilterOptions(this.supabase);
    if (!isGlobalAdmin(caller)) {
      if (!caller.organizationId) return { forms, organizations: [] };
      const { data, error } = await this.supabase
        .from("organizations")
        .select("id, name")
        .eq("id", caller.organizationId)
        .maybeSingle();
      if (error) throw error;
      return {
        forms,
        organizations: data ? [data as OrgRow] : [],
      };
    }

    const organizations = await listOrganizationFilterOptions(this.supabase);
    return {
      forms,
      organizations: organizations.map(({ id, name }) => ({ id, name })),
    };
  }

  // -- Internos ---------------------------------------------------------

  protected parse<T>(schema: ZodType<T>, input: unknown): T {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        path: i.path.map((p) => String(p)).join(".") || "_",
        message: i.message,
      }));
      throw new DomainValidationError(
        issues.length > 0
          ? issues
          : [{ path: "_", message: "Dados inválidos." }],
        "Dados inválidos para evidências.",
      );
    }
    return parsed.data;
  }
}
