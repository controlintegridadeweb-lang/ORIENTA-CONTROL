import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { chunkValues, collectPostgrestPages } from "@/infrastructure/supabase/pagination";
import {
  AUDIT_ID_CHUNK_SIZE,
  EVIDENCE_JOIN_SELECT,
  EVIDENCE_PAGE_SIZE,
  evidenceAuditRowSchema,
  joinedEvidenceRowSchema,
  responseHierarchySchema,
  type EvidenceAuditRow,
  type EvidenceQueryFilters,
  type JoinedEvidenceRow,
} from "./contracts";

export async function resolveEvidenceIdsByHierarchy(
  client: SupabaseClient,
  filters: Pick<
    EvidenceQueryFilters,
    "organizationId" | "cycleId" | "formId" | "axisName" | "sectionName"
  >,
): Promise<string[] | null> {
  const axisName = filters.axisName?.trim();
  const sectionName = filters.sectionName?.trim();
  if (!axisName && !sectionName) return null;

  const idSchema = z.object({ id: z.string().uuid() });
  const rows = await collectPostgrestPages<{ id: string }>(async (from, to) => {
    let query = client
      .from("evidences")
      .select(
        "id, responses!inner(cycle_id, cycles!inner(organization_id, form_versions!inner(form_id)), question_versions!inner(axis_name, section_name))",
      )
      .is("deactivated_at", null)
      .order("id", { ascending: true });

    if (filters.organizationId) {
      query = query.eq("responses.cycles.organization_id", filters.organizationId);
    }
    if (filters.cycleId) query = query.eq("responses.cycle_id", filters.cycleId);
    if (filters.formId) {
      query = query.eq("responses.cycles.form_versions.form_id", filters.formId);
    }
    if (axisName) query = query.eq("responses.question_versions.axis_name", axisName);
    if (sectionName) {
      query = query.eq("responses.question_versions.section_name", sectionName);
    }

    const { data, error } = await query.range(from, to);
    if (error) return { data: null, error };
    return { data: z.array(idSchema).parse(data ?? []), error: null };
  });

  return rows.map((row) => row.id);
}

export function mergeEvidenceIdFilters(
  explicitIds: string[] | undefined,
  hierarchyIds: string[] | null,
): string[] | undefined {
  if (hierarchyIds == null) return explicitIds;
  if (hierarchyIds.length === 0) return [];
  if (!explicitIds?.length) return hierarchyIds;
  const allowed = new Set(hierarchyIds);
  return explicitIds.filter((id) => allowed.has(id));
}

export async function loadEvidenceRows(
  client: SupabaseClient,
  filters: EvidenceQueryFilters,
): Promise<JoinedEvidenceRow[]> {
  const rows: JoinedEvidenceRow[] = [];
  const idChunks = filters.ids?.length
    ? chunkValues([...new Set(filters.ids)])
    : [null];

  for (const idChunk of idChunks) {
    let offset = 0;
    while (true) {
      let query = client
        .from("evidences")
        .select(EVIDENCE_JOIN_SELECT)
        .is("deactivated_at", null)
        .order("submitted_at", { ascending: false })
        .order("id", { ascending: false });

      if (filters.cycleId) query = query.eq("responses.cycle_id", filters.cycleId);
      if (filters.organizationId) {
        query = query.eq("responses.cycles.organization_id", filters.organizationId);
      }
      if (filters.formId) {
        query = query.eq("responses.cycles.form_versions.form_id", filters.formId);
      }
      if (filters.questionId) {
        query = query.eq("responses.question_versions.question_id", filters.questionId);
      }
      if (filters.from) query = query.gte("submitted_at", filters.from);
      if (filters.to) query = query.lte("submitted_at", filters.to);
      if (filters.axisName) {
        query = query.eq("responses.question_versions.axis_name", filters.axisName);
      }
      if (filters.sectionName) {
        query = query.eq("responses.question_versions.section_name", filters.sectionName);
      }
      if (idChunk) query = query.in("id", idChunk);

      const { data, error } = await query.range(
        offset,
        offset + EVIDENCE_PAGE_SIZE - 1,
      );
      if (error) throw error;

      const page = z.array(joinedEvidenceRowSchema).parse(data ?? []);
      rows.push(...page);
      if (page.length === 0) break;
      offset += page.length;
    }
  }

  rows.sort(
    (a, b) =>
      b.submitted_at.localeCompare(a.submitted_at) || b.id.localeCompare(a.id),
  );
  return rows;
}

export async function loadEvidenceAuditHistory(
  client: SupabaseClient,
  evidenceIds: string[],
): Promise<Map<string, EvidenceAuditRow[]>> {
  const byEvidence = new Map<string, EvidenceAuditRow[]>();

  for (const chunk of chunkValues(evidenceIds, AUDIT_ID_CHUNK_SIZE)) {
    let offset = 0;
    while (true) {
      const { data, error } = await client
        .from("audit_logs")
        .select("id, record_id, actor_user_id, before_json, after_json, created_at")
        .eq("entity_type", "evidences")
        .in("record_id", chunk)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + EVIDENCE_PAGE_SIZE - 1);
      if (error) throw error;

      const page = z.array(evidenceAuditRowSchema).parse(data ?? []);
      for (const row of page) {
        const current = byEvidence.get(row.record_id) ?? [];
        current.push(row);
        byEvidence.set(row.record_id, current);
      }
      if (page.length === 0) break;
      offset += page.length;
    }
  }

  return byEvidence;
}

export async function loadAxisSectionByResponseId(
  client: SupabaseClient,
  responseIds: string[],
): Promise<Map<string, { axisName: string; sectionName: string }>> {
  const uniqueIds = [...new Set(responseIds.filter(Boolean))];
  const byResponse = new Map<string, { axisName: string; sectionName: string }>();
  if (uniqueIds.length === 0) return byResponse;

  for (const chunk of chunkValues(uniqueIds, AUDIT_ID_CHUNK_SIZE)) {
    const { data, error } = await client
      .from("responses")
      .select("id, question_versions!inner(axis_name, section_name)")
      .in("id", chunk);
    if (error) throw error;

    for (const row of z.array(responseHierarchySchema).parse(data ?? [])) {
      byResponse.set(row.id, {
        axisName: row.question_versions.axis_name.trim(),
        sectionName: row.question_versions.section_name.trim(),
      });
    }
  }

  return byResponse;
}
