import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { EvidenceListItem } from "./types";
import {
  evidencePageRpcRowSchema,
  type EvidenceMetrics,
  type EvidenceQueryFilters,
  type HydratedEvidencePage,
} from "./read-model/contracts";
import {
  buildCurrentHistory,
  mapAuditHistory,
  mapEvidencePageRpcRow,
  mapEvidenceRow,
} from "./read-model/mappers";
import {
  loadAxisSectionByResponseId,
  loadEvidenceAuditHistory,
  loadEvidenceRows,
  mergeEvidenceIdFilters,
  resolveEvidenceIdsByHierarchy,
} from "./read-model/queries";

export { mapEmbeddedValidationToUi } from "./read-model/mappers";
export type { EvidenceQueryFilters, HydratedEvidencePage } from "./read-model/contracts";

export async function loadHydratedEvidences(
  client: SupabaseClient,
  filters: EvidenceQueryFilters,
): Promise<EvidenceListItem[]> {
  const rows = await loadEvidenceRows(client, filters);
  const auditByEvidence = await loadEvidenceAuditHistory(
    client,
    rows.map((row) => row.id),
  );

  return rows.map((row) => {
    const auditHistory = mapAuditHistory(auditByEvidence.get(row.id) ?? []);
    return mapEvidenceRow(
      row,
      auditHistory.length > 0 ? auditHistory : buildCurrentHistory(row),
    );
  });
}

export async function loadHydratedEvidencesPage(
  client: SupabaseClient,
  filters: EvidenceQueryFilters,
  limit: number,
  offset: number,
): Promise<HydratedEvidencePage> {
  const hierarchyIds = await resolveEvidenceIdsByHierarchy(client, filters);
  const ids = mergeEvidenceIdFilters(filters.ids, hierarchyIds);
  if (ids && ids.length === 0) return { total: 0, items: [] };

  const { data, error } = await client.rpc("list_evidences_page", {
    p_search: filters.search?.trim() || null,
    p_status: filters.status ?? null,
    p_pending_only: filters.pendingOnly ?? false,
    p_cycle_id: filters.cycleId ?? null,
    p_organization_id: filters.organizationId ?? null,
    p_form_id: filters.formId ?? null,
    p_question_id: filters.questionId ?? null,
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
    p_ids: ids?.length ? [...new Set(ids)] : null,
    p_limit: limit,
    p_offset: offset,
    p_exclude_status: filters.excludeStatus ?? null,
  });
  if (error) throw error;

  const rows = z.array(evidencePageRpcRowSchema).parse(data ?? []);
  const [auditByEvidence, hierarchyByResponse] = await Promise.all([
    loadEvidenceAuditHistory(client, rows.map((row) => row.id)),
    loadAxisSectionByResponseId(client, rows.map((row) => row.response_id)),
  ]);

  return {
    total: Number(rows[0]?.total_count ?? 0),
    items: rows.map((row) => {
      const item = mapEvidencePageRpcRow(
        row,
        mapAuditHistory(auditByEvidence.get(row.id) ?? []),
      );
      const hierarchy = hierarchyByResponse.get(row.response_id);
      return hierarchy
        ? {
            ...item,
            axisName: hierarchy.axisName || item.axisName,
            sectionName: hierarchy.sectionName || item.sectionName,
          }
        : item;
    }),
  };
}

const EMPTY_METRICS: EvidenceMetrics = {
  total: 0,
  aguardando_envio: 0,
  aguardando_validacao: 0,
  ajuste_solicitado: 0,
  aprovadas: 0,
  nao_aprovadas: 0,
};

export async function loadEvidenceMetrics(
  client: SupabaseClient,
  filters: EvidenceQueryFilters,
): Promise<EvidenceMetrics> {
  const hierarchyIds = await resolveEvidenceIdsByHierarchy(client, filters);
  const ids = mergeEvidenceIdFilters(filters.ids, hierarchyIds);
  if (ids && ids.length === 0) return { ...EMPTY_METRICS };

  const { data, error } = await client.rpc("get_evidence_metrics", {
    p_search: filters.search?.trim() || null,
    p_status: filters.status ?? null,
    p_pending_only: filters.pendingOnly ?? false,
    p_cycle_id: filters.cycleId ?? null,
    p_organization_id: filters.organizationId ?? null,
    p_form_id: filters.formId ?? null,
    p_question_id: filters.questionId ?? null,
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
    p_ids: ids?.length ? [...new Set(ids)] : null,
  });
  if (error) throw error;

  const row = data?.[0];
  return {
    total: Number(row?.total ?? 0),
    aguardando_envio: Number(row?.aguardando_envio ?? 0),
    aguardando_validacao: Number(row?.aguardando_validacao ?? 0),
    ajuste_solicitado: Number(row?.ajuste_solicitado ?? 0),
    aprovadas: Number(row?.aprovadas ?? 0),
    nao_aprovadas: Number(row?.nao_aprovadas ?? 0),
  };
}
