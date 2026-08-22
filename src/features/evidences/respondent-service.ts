import "server-only";

import { z } from "zod";
import { EvidencesAdminService } from "./admin-service";
import type { EvidenceListItem } from "./types";
import {
  deriveValidationStatus,
  overallStatus,
  respondentStatusNeedsAction,
} from "./respondent-evidence-helpers";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { collectPostgrestPages } from "@/infrastructure/supabase/pagination";
import type { RespondentStatsResult } from "./respondent-stats-types";
import {
  countRespondentProofRequests,
  listProofRequestFilterCycles,
  listRespondentProofRequests,
} from "./respondent-proof-requests";

export type { RespondentStatsResult } from "./respondent-stats-types";

import {
  type RespondentEvidenceItem,
  type RespondentEvidenceListQuery,
} from "./respondent-contracts";

export { respondentEvidenceListQuerySchema } from "./respondent-contracts";
export type { RespondentEvidenceItem, RespondentEvidenceListQuery } from "./respondent-contracts";

export type RespondentEvidenceListResult = {
  items: RespondentEvidenceItem[];
  total: number;
  limit: number;
  offset: number;
};

export type RespondentCaller = { organizationId: string };

type ProofRequestDeps = {
  listProofRequests: (
    organizationId: string,
    query: Pick<
      RespondentEvidenceListQuery,
      "cycleId" | "formId" | "search" | "axisName" | "sectionName"
    >,
  ) => Promise<RespondentEvidenceItem[]>;
  countProofRequests: (
    organizationId: string,
    query: Pick<
      RespondentEvidenceListQuery,
      "cycleId" | "formId" | "search" | "axisName" | "sectionName"
    >,
  ) => Promise<number>;
};

const defaultProofRequestDeps: ProofRequestDeps = {
  async listProofRequests(organizationId, query) {
    return listRespondentProofRequests(
      createSupabaseServiceRoleClient(),
      organizationId,
      query,
    );
  },
  async countProofRequests(organizationId, query) {
    return countRespondentProofRequests(
      createSupabaseServiceRoleClient(),
      organizationId,
      query,
    );
  },
};

function enrich(item: EvidenceListItem): RespondentEvidenceItem {
  const respondentStatus = deriveValidationStatus(item);
  return {
    ...item,
    respondentStatus,
    needsAction: respondentStatusNeedsAction(respondentStatus),
    lastComplementationAt:
      respondentStatus === "adjustment_requested" ? item.lastValidatedAt ?? null : null,
  };
}

function mergeAdjustmentPages(
  proofItems: RespondentEvidenceItem[],
  evidenceItems: RespondentEvidenceItem[],
  evidenceTotal: number,
  offset: number,
  limit: number,
): { items: RespondentEvidenceItem[]; total: number } {
  const total = proofItems.length + evidenceTotal;
  if (offset >= proofItems.length) {
    return {
      items: evidenceItems,
      total,
    };
  }
  const proofSlice = proofItems.slice(offset, offset + limit);
  const remaining = Math.max(0, limit - proofSlice.length);
  return {
    items: remaining > 0 ? [...proofSlice, ...evidenceItems.slice(0, remaining)] : proofSlice,
    total,
  };
}

export class RespondentEvidencesService {
  private admin: EvidencesAdminService;
  private proofRequests: ProofRequestDeps;

  constructor(
    admin?: EvidencesAdminService,
    proofRequests?: Partial<ProofRequestDeps>,
  ) {
    this.admin = admin ?? new EvidencesAdminService();
    this.proofRequests = {
      listProofRequests:
        proofRequests?.listProofRequests ?? defaultProofRequestDeps.listProofRequests,
      countProofRequests:
        proofRequests?.countProofRequests ?? defaultProofRequestDeps.countProofRequests,
    };
  }

  async list(
    caller: RespondentCaller,
    query: RespondentEvidenceListQuery,
  ): Promise<RespondentEvidenceListResult> {
    const wantsAdjustments =
      query.status === "adjustment_requested" || Boolean(query.pendingOnly);

    if (wantsAdjustments) {
      const proofItems = await this.proofRequests.listProofRequests(
        caller.organizationId,
        query,
      );
      const evidenceOffset = Math.max(0, query.offset - proofItems.length);
      const evidenceLimit =
        query.offset >= proofItems.length
          ? query.limit
          : Math.max(0, query.limit - (proofItems.length - query.offset));
      const evidencePage =
        evidenceLimit > 0
          ? await this.admin.list(
              {
                organizationId: caller.organizationId,
                cycleId: query.cycleId,
                formId: query.formId,
                search: query.search,
                axisName: query.axisName,
                sectionName: query.sectionName,
                status: "adjustment_requested",
                pendingOnly: true,
                limit: evidenceLimit,
                offset: evidenceOffset,
              },
              {
                organizationId: caller.organizationId,
                role: "respondent",
              },
            )
          : { items: [], total: 0, limit: query.limit, offset: query.offset };

      // total de evidências com ajuste: quando evidenceLimit=0 ainda precisamos do total
      let evidenceTotal = evidencePage.total;
      if (evidenceLimit === 0) {
        const countPage = await this.admin.list(
          {
            organizationId: caller.organizationId,
            cycleId: query.cycleId,
            formId: query.formId,
            search: query.search,
            axisName: query.axisName,
            sectionName: query.sectionName,
            status: "adjustment_requested",
            pendingOnly: true,
            limit: 1,
            offset: 0,
          },
          {
            organizationId: caller.organizationId,
            role: "respondent",
          },
        );
        evidenceTotal = countPage.total;
      }

      const merged = mergeAdjustmentPages(
        proofItems,
        evidencePage.items.map(enrich),
        evidenceTotal,
        query.offset,
        query.limit,
      );
      return {
        items: merged.items,
        total: merged.total,
        limit: query.limit,
        offset: query.offset,
      };
    }

    const page = await this.admin.list(
      {
        organizationId: caller.organizationId,
        cycleId: query.cycleId,
        formId: query.formId,
        search: query.search,
        axisName: query.axisName,
        sectionName: query.sectionName,
        status: query.status,
        pendingOnly: query.pendingOnly,
        excludeStatus: "adjustment_requested",
        limit: query.limit,
        offset: query.offset,
      },
      {
        organizationId: caller.organizationId,
        role: "respondent",
      },
    );
    return {
      ...page,
      items: page.items.map(enrich),
    };
  }

  async stats(
    caller: RespondentCaller,
    query: Omit<RespondentEvidenceListQuery, "limit" | "offset">,
  ) {
    const [metrics, proofCount] = await Promise.all([
      this.admin.getStats(
        {
          organizationId: caller.organizationId,
          cycleId: query.cycleId,
          formId: query.formId,
          search: query.search,
          axisName: query.axisName,
          sectionName: query.sectionName,
          status: query.status,
          pendingOnly: query.pendingOnly,
        },
        {
          organizationId: caller.organizationId,
          role: "respondent",
        },
      ),
      this.proofRequests.countProofRequests(caller.organizationId, query),
    ]);
    const pending = metrics.aguardando_envio;
    const adjustment = metrics.ajuste_solicitado + proofCount;
    const submitted = metrics.aguardando_validacao;
    return {
      enviadas: pending,
      aprovadas: metrics.aprovadas,
      aguardando: submitted,
      reprovadas: metrics.nao_aprovadas,
      complementacao: adjustment,
      overall: overallStatus({ pending, adjustment, submitted }),
      hasPendency: pending + adjustment > 0,
    } satisfies RespondentStatsResult;
  }
}

export type RespondentEvidenceFilterOptions = {
  forms: { id: string; name: string }[];
  cycles: { id: string; formId: string; formName: string; periodLabel: string }[];
  /** Pares eixo/seção presentes nas evidências ou solicitações da organização. */
  hierarchy: { formId: string; axisName: string; sectionName: string }[];
};

const hierarchyOptionRowSchema = z.object({
  responses: z.object({
    cycles: z.object({
      form_versions: z.object({
        form_id: z.string().uuid(),
      }),
    }),
    question_versions: z.object({
      axis_name: z.string(),
      section_name: z.string(),
    }),
  }),
});

const proofHierarchyOptionRowSchema = z.object({
  cycles: z.object({
    form_versions: z.object({
      form_id: z.string().uuid(),
    }),
  }),
  question_versions: z.object({
    axis_name: z.string(),
    section_name: z.string(),
  }),
});

async function listRespondentEvidenceHierarchyOptions(
  organizationId: string,
): Promise<{ formId: string; axisName: string; sectionName: string }[]> {
  const client = createSupabaseServiceRoleClient();
  const [evidenceData, proofData] = await Promise.all([
    collectPostgrestPages(async (from, to) => {
      const { data, error } = await client
        .from("evidences")
        .select(
          "responses!inner(cycles!inner(organization_id, form_versions!inner(form_id)), question_versions!inner(axis_name, section_name))",
        )
        .eq("responses.cycles.organization_id", organizationId)
        .is("deactivated_at", null)
        .order("id", { ascending: true })
        .range(from, to);
      return { data, error };
    }),
    collectPostgrestPages(async (from, to) => {
      const { data, error } = await client
        .from("responses")
        .select(
          "cycles!inner(organization_id, state, form_versions!inner(form_id)), question_versions!inner(axis_name, section_name)",
        )
        .eq("admin_proof_status", "proof_requested")
        .eq("cycles.organization_id", organizationId)
        .neq("cycles.state", "draft")
        .order("id", { ascending: true })
        .range(from, to);
      return { data, error };
    }),
  ]);

  const pairs = new Map<string, { formId: string; axisName: string; sectionName: string }>();
  for (const row of z.array(hierarchyOptionRowSchema).parse(evidenceData)) {
    const axisName = row.responses.question_versions.axis_name.trim();
    const sectionName = row.responses.question_versions.section_name.trim();
    if (!axisName) continue;
    const formId = row.responses.cycles.form_versions.form_id;
    pairs.set(`${formId}\0${axisName}\0${sectionName}`, { formId, axisName, sectionName });
  }
  for (const row of z.array(proofHierarchyOptionRowSchema).parse(proofData)) {
    const axisName = row.question_versions.axis_name.trim();
    const sectionName = row.question_versions.section_name.trim();
    if (!axisName) continue;
    const formId = row.cycles.form_versions.form_id;
    pairs.set(`${formId}\0${axisName}\0${sectionName}`, { formId, axisName, sectionName });
  }

  return [...pairs.values()].sort(
    (a, b) =>
      a.axisName.localeCompare(b.axisName, "pt-BR") ||
      a.sectionName.localeCompare(b.sectionName, "pt-BR") ||
      a.formId.localeCompare(b.formId),
  );
}

/** Opções derivadas dos ciclos com evidências ou comprovação solicitada. */
export async function respondentEvidenceFilterOptions(
  organizationId: string,
): Promise<RespondentEvidenceFilterOptions> {
  const client = createSupabaseServiceRoleClient();
  const [{ data, error }, proofCycles, hierarchy] = await Promise.all([
    client.rpc("list_respondent_evidence_filter_options", {
      p_organization_id: organizationId,
    }),
    listProofRequestFilterCycles(client, organizationId),
    listRespondentEvidenceHierarchyOptions(organizationId),
  ]);
  if (error) throw error;
  const rows = z
    .array(
      z.object({
        cycle_id: z.string().uuid(),
        form_id: z.string().uuid(),
        form_name: z.string(),
        period_label: z.string(),
      }),
    )
    .parse(data ?? []);
  const cyclesById = new Map<
    string,
    { id: string; formId: string; formName: string; periodLabel: string }
  >();
  for (const row of rows) {
    cyclesById.set(row.cycle_id, {
      id: row.cycle_id,
      formId: row.form_id,
      formName: row.form_name,
      periodLabel: row.period_label,
    });
  }
  for (const cycle of proofCycles) {
    cyclesById.set(cycle.id, cycle);
  }
  const cycles = [...cyclesById.values()].sort(
    (a, b) =>
      a.formName.localeCompare(b.formName, "pt-BR") ||
      b.periodLabel.localeCompare(a.periodLabel, "pt-BR"),
  );
  const forms = Array.from(
    new Map(
      cycles.map((cycle) => [cycle.formId, { id: cycle.formId, name: cycle.formName }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return { forms, cycles, hierarchy };
}
