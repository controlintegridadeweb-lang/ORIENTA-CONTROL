import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isEvidenceRequired } from "@/shared/domain/evidence-parameter";
import type { CycleState } from "@/shared/domain/types";
import type { RespondentEvidenceItem, RespondentEvidenceListQuery } from "./respondent-contracts";

const proofRequestRowSchema = z.object({
  id: z.string().uuid(),
  cycle_id: z.string().uuid(),
  question_version_id: z.string().uuid(),
  admin_proof_observation: z.string().nullable(),
  admin_proof_decided_at: z.string().nullable(),
  updated_at: z.string(),
  cycles: z.object({
    id: z.string().uuid(),
    state: z.string(),
    period_label: z.string(),
    organization_id: z.string().uuid(),
    form_versions: z.object({
      version: z.number().int(),
      forms: z.object({
        id: z.string().uuid(),
        name: z.string(),
      }),
    }),
    organizations: z.object({
      id: z.string().uuid(),
      name: z.string(),
    }),
  }),
  question_versions: z.object({
    question_id: z.string().uuid(),
    prompt: z.string(),
    axis_name: z.string(),
    section_name: z.string(),
    evidence_parameter: z.unknown(),
  }),
});

function matchesSearch(
  row: z.infer<typeof proofRequestRowSchema>,
  search: string | undefined,
): boolean {
  if (!search) return true;
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    row.question_versions.prompt,
    row.question_versions.axis_name,
    row.question_versions.section_name,
    row.cycles.form_versions.forms.name,
    row.admin_proof_observation ?? "",
    "Comprovação solicitada",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function matchesHierarchy(
  row: z.infer<typeof proofRequestRowSchema>,
  axisName: string | undefined,
  sectionName: string | undefined,
): boolean {
  if (axisName && row.question_versions.axis_name.trim() !== axisName) return false;
  if (sectionName && row.question_versions.section_name.trim() !== sectionName) {
    return false;
  }
  return true;
}

/**
 * Solicitações de comprovação ausente (`proof_requested`) como itens da fila
 * de ajustes do respondente — o mesmo papel visual das evidências devolvidas.
 */
export async function listRespondentProofRequests(
  supabase: SupabaseClient,
  organizationId: string,
  query: Pick<
    RespondentEvidenceListQuery,
    "cycleId" | "formId" | "search" | "axisName" | "sectionName"
  >,
): Promise<RespondentEvidenceItem[]> {
  let builder = supabase
    .from("responses")
    .select(
      "id, cycle_id, question_version_id, admin_proof_observation, admin_proof_decided_at, updated_at, " +
        "cycles!inner(id, state, period_label, organization_id, " +
        "form_versions!inner(version, forms!form_versions_form_id_fkey!inner(id, name)), " +
        "organizations!inner(id, name)), " +
        "question_versions!inner(question_id, prompt, axis_name, section_name, evidence_parameter)",
    )
    .eq("admin_proof_status", "proof_requested")
    .eq("cycles.organization_id", organizationId)
    .neq("cycles.state", "draft");

  if (query.cycleId) builder = builder.eq("cycle_id", query.cycleId);

  const { data, error } = await builder.order("admin_proof_decided_at", {
    ascending: false,
    nullsFirst: false,
  });
  if (error) throw error;

  const rows = z
    .array(proofRequestRowSchema)
    .parse(data ?? [])
    .filter((row) =>
      query.formId ? row.cycles.form_versions.forms.id === query.formId : true,
    );
  const responseIds = rows.map((row) => row.id);
  const pendingByResponse = new Set<string>();
  if (responseIds.length > 0) {
    const { data: pendingData, error: pendingError } = await supabase
      .from("evidences")
      .select("response_id")
      .in("response_id", responseIds)
      .is("deactivated_at", null)
      .eq("validation_status", "pending");
    if (pendingError) throw pendingError;
    for (const row of pendingData ?? []) {
      pendingByResponse.add(row.response_id as string);
    }
  }

  return rows
    .filter((row) => !pendingByResponse.has(row.id))
    .filter((row) => matchesSearch(row, query.search))
    .filter((row) => matchesHierarchy(row, query.axisName, query.sectionName))
    .map((row) => {
      const decidedAt = row.admin_proof_decided_at ?? row.updated_at;
      return {
        id: `proof:${row.id}`,
        responseId: row.id,
        cycleId: row.cycle_id,
        cycleState: row.cycles.state as CycleState,
        organizationId: row.cycles.organization_id,
        organizationName: row.cycles.organizations.name,
        formId: row.cycles.form_versions.forms.id,
        formName: row.cycles.form_versions.forms.name,
        formVersion: row.cycles.form_versions.version,
        periodLabel: row.cycles.period_label,
        questionId: row.question_versions.question_id,
        questionPrompt: row.question_versions.prompt,
        axisName: row.question_versions.axis_name,
        sectionName: row.question_versions.section_name,
        requiresEvidence: isEvidenceRequired({
          evidence_parameter: row.question_versions.evidence_parameter,
        }),
        title: "Comprovação solicitada",
        description: row.admin_proof_observation?.trim() || "",
        evidenceType: "proof_request",
        storagePath: null,
        externalLink: null,
        textBody: null,
        exceptionReason: null,
        submittedAt: decidedAt,
        submittedBy: "",
        currentStatus: "adjustment_requested",
        lastValidatedAt: decidedAt,
        lastJustification: row.admin_proof_observation?.trim() || null,
        history: [],
        respondentStatus: "adjustment_requested",
        needsAction: true,
        lastComplementationAt: decidedAt,
      } satisfies RespondentEvidenceItem;
    });
}

export async function countRespondentProofRequests(
  supabase: SupabaseClient,
  organizationId: string,
  query: Pick<
    RespondentEvidenceListQuery,
    "cycleId" | "formId" | "search" | "axisName" | "sectionName"
  >,
): Promise<number> {
  const items = await listRespondentProofRequests(supabase, organizationId, query);
  return items.length;
}

const proofRequestFilterCycleSchema = z.object({
  cycle_id: z.string().uuid(),
  cycles: z.object({
    id: z.string().uuid(),
    period_label: z.string(),
    form_versions: z.object({
      forms: z.object({
        id: z.string().uuid(),
        name: z.string(),
      }),
    }),
  }),
});

export async function listProofRequestFilterCycles(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<
  { id: string; formId: string; formName: string; periodLabel: string }[]
> {
  const { data, error } = await supabase
    .from("responses")
    .select(
      "cycle_id, cycles!inner(id, period_label, organization_id, " +
        "form_versions!inner(forms!form_versions_form_id_fkey!inner(id, name)))",
    )
    .eq("admin_proof_status", "proof_requested")
    .eq("cycles.organization_id", organizationId);
  if (error) throw error;

  const cycles = new Map<
    string,
    { id: string; formId: string; formName: string; periodLabel: string }
  >();
  for (const row of z.array(proofRequestFilterCycleSchema).parse(data ?? [])) {
    cycles.set(row.cycle_id, {
      id: row.cycles.id,
      formId: row.cycles.form_versions.forms.id,
      formName: row.cycles.form_versions.forms.name,
      periodLabel: row.cycles.period_label,
    });
  }
  return [...cycles.values()];
}
