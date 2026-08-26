import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sortAxesMaturity } from "@/features/fami";
import {
  loadFrozenFamiScopeCatalog,
  resolveCycleProcessingIdForCycle,
} from "@/features/fami/server";
import type {
  CycleFamiReportSnapshot,
  CycleReportScope,
  ReportDiagnostic,
  ReportDiagnosticCriterion,
  ReportDiagnosticResult,
  ReportEvidenceStatus,
  ReportEvidenceSummary,
  ReportFamiSectionScore,
} from "./report-types";
import { isEvidenceRequired } from "@/shared/domain/evidence-parameter";

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const reportOrganizationSchema = z.object({ name: z.string() });
const reportFormSchema = z.object({ name: z.string() });
const reportFormVersionSchema = z.object({
  form_id: z.string().min(1),
  version: z.number(),
  forms: z.union([reportFormSchema, z.array(reportFormSchema)]).nullable(),
});
const cycleReportScopeRowSchema = z.object({
  id: z.string().min(1),
  state: z.string(),
  form_version_id: z.string().min(1),
  organization_id: z.string().min(1),
  response_deadline_at: z.string().nullable(),
  period_label: z.string(),
  reference_start_year: z.number().int().nullable(),
  reference_end_year: z.number().int().nullable(),
  action_plan_revision: z.number().int().nonnegative(),
  organizations: z.union([reportOrganizationSchema, z.array(reportOrganizationSchema)]).nullable(),
  form_versions: z.union([reportFormVersionSchema, z.array(reportFormVersionSchema)]).nullable(),
});

/** Resolve o único escopo operacional aceito pela emissão de relatório. */
export async function resolveCycleReportScope(
  supabase: SupabaseClient,
  cycleId: string,
): Promise<CycleReportScope | null> {
  const { data, error } = await supabase
    .from("cycles")
    .select(
      "id, state, form_version_id, organization_id, response_deadline_at, period_label, reference_start_year, reference_end_year, action_plan_revision, " +
        "organizations!inner(name), " +
        "form_versions!inner(form_id, version, forms!form_versions_form_id_fkey!inner(name))",
    )
    .eq("id", cycleId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = cycleReportScopeRowSchema.parse(data);
  const formVersion = first(row.form_versions);
  const organization = first(row.organizations);
  const form = first(formVersion?.forms);
  if (!formVersion?.form_id || !form?.name || !organization?.name) return null;

  return {
    cycleId: row.id,
    cycleState: row.state,
    formVersionId: row.form_version_id,
    formId: formVersion.form_id,
    formName: form.name,
    formVersion: Number(formVersion.version ?? 0),
    organizationId: row.organization_id,
    organizationName: organization.name,
    responseDeadlineAt: row.response_deadline_at ?? null,
    periodLabel: row.period_label,
    referenceStartYear: row.reference_start_year,
    referenceEndYear: row.reference_end_year,
    actionPlanRevision: row.action_plan_revision,
  };
}

export async function resolveLatestCycleFamiVersion(
  supabase: SupabaseClient,
  cycleId: string,
): Promise<number | null> {
  const { data: processings, error: processingError } = await supabase
    .from("cycle_processings")
    .select("id, processing_version")
    .eq("cycle_id", cycleId)
    .eq("status", "completed")
    .order("processing_version", { ascending: false });
  if (processingError) throw processingError;
  if (!processings?.length) return null;

  const versionByProcessing = new Map(
    processings.map((row) => [row.id as string, Number(row.processing_version)]),
  );
  const { data: result, error: resultError } = await supabase
    .from("fami_results")
    .select("cycle_processing_id")
    .in("cycle_processing_id", [...versionByProcessing.keys()])
    .eq("scope_type", "global");
  if (resultError) throw resultError;

  const versionsWithGlobal = (result ?? [])
    .map((row) => versionByProcessing.get(row.cycle_processing_id as string))
    .filter((version): version is number => version != null);
  return versionsWithGlobal.length ? Math.max(...versionsWithGlobal) : null;
}

export async function loadCycleFamiReportSnapshot(
  supabase: SupabaseClient,
  cycleId: string,
  processingVersion: number,
): Promise<CycleFamiReportSnapshot | null> {
  const cycleProcessingId = await resolveCycleProcessingIdForCycle(
    supabase,
    cycleId,
    processingVersion,
  );
  if (!cycleProcessingId) return null;

  const { data: processing, error: processingError } = await supabase
    .from("cycle_processings")
    .select("processing_version, fami_policy_version, status, completed_at")
    .eq("id", cycleProcessingId)
    .eq("cycle_id", cycleId)
    .maybeSingle();
  if (processingError) throw processingError;
  if (!processing) return null;

  const { data, error } = await supabase
    .from("fami_results")
    .select("scope_type, scope_id, percentage, maturity_level, points_obtained, points_possible, created_at")
    .eq("cycle_processing_id", cycleProcessingId)
    .in("scope_type", ["global", "axis", "section"]);
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    scope_type: string;
    scope_id: string | null;
    percentage: number | null;
    maturity_level: number | null;
    points_obtained: number | null;
    points_possible: number | null;
    created_at: string | null;
  }>;
  const globalRow = rows.find((row) => row.scope_type === "global");
  const axisRows = rows.filter((row) => row.scope_type === "axis" && row.scope_id);
  const sectionRows = rows.filter((row) => row.scope_type === "section" && row.scope_id);
  const catalog = await loadFrozenFamiScopeCatalog(supabase, cycleId);

  const sections: ReportFamiSectionScore[] = sectionRows
    .map((row) => {
      const sectionId = row.scope_id!;
      const frozen = catalog.sections.get(sectionId);
      return {
        sectionId,
        sectionName: frozen?.name ?? "Seção histórica sem identificação",
        axisId: frozen?.axisId ?? null,
        percentage: Number(row.percentage ?? 0),
        maturityLevel: row.maturity_level == null ? null : Number(row.maturity_level),
        pointsObtained: Number(row.points_obtained ?? 0),
        pointsPossible: Number(row.points_possible ?? 0),
        order: frozen?.order ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => a.order - b.order || a.sectionName.localeCompare(b.sectionName, "pt-BR"))
    .map(({ order, ...section }) => ({
      ...section,
      sectionOrder: order,
    }));

  const axesWithPoints = sortAxesMaturity(
    axisRows.map((row) => ({
      axisId: row.scope_id!,
      axisName: catalog.axes.get(row.scope_id!)?.name ?? "Eixo histórico sem identificação",
      percentage: Number(row.percentage ?? 0),
      maturityLevel: row.maturity_level == null ? null : Number(row.maturity_level),
    })),
  ).map((axis) => {
    const source = axisRows.find((row) => row.scope_id === axis.axisId);
    return {
      ...axis,
      pointsObtained: Number(source?.points_obtained ?? 0),
      pointsPossible: Number(source?.points_possible ?? 0),
    };
  });

  return {
    cycleProcessingId,
    processingVersion: Number(processing.processing_version ?? processingVersion),
    policyVersion: String(processing.fami_policy_version ?? ""),
    processingStatus: processing.status === "completed" ? "completed" : "working",
    processingCompletedAt: processing.completed_at ? String(processing.completed_at) : null,
    global: globalRow
      ? {
          percentage: Number(globalRow.percentage ?? 0),
          maturityLevel: globalRow.maturity_level == null ? null : Number(globalRow.maturity_level),
          pointsObtained: Number(globalRow.points_obtained ?? 0),
          pointsPossible: Number(globalRow.points_possible ?? 0),
          createdAt: String(globalRow.created_at ?? ""),
        }
      : null,
    axes: axesWithPoints,
    sections,
  };
}

export async function loadCycleEvidenceSummary(
  supabase: SupabaseClient,
  cycleProcessingId: string,
): Promise<ReportEvidenceSummary> {
  const empty: ReportEvidenceSummary = {
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    complementation: 0,
  };

  const { data: evidences, error } = await supabase
    .from("evidence_snapshots")
    .select("validation_status")
    .eq("cycle_processing_id", cycleProcessingId);
  if (error) throw error;
  if (!evidences?.length) return empty;

  const summary = { ...empty, total: evidences.length };
  for (const row of evidences) {
    const status = String(row.validation_status ?? "pending");
    if (status === "approved") summary.approved += 1;
    else if (status === "invalidated") summary.rejected += 1;
    else if (status === "adjustment_requested") summary.complementation += 1;
    else summary.pending += 1;
  }
  return summary;
}

type DiagnosticResponseRow = {
  question_version_id: string;
  answer: "yes" | "no" | "not_applicable";
  is_not_applicable: boolean;
  na_justification: string | null;
  na_original_justification: string | null;
  na_rejection_reason: string | null;
};

type DiagnosticQuestionVersionRow = {
  axis_id: string;
  axis_name: string;
  section_id: string;
  section_name: string;
  section_order: number;
  prompt: string;
  evidence_parameter: unknown;
  fami_enabled: boolean;
  applies_to_respondent: boolean;
};

type DiagnosticQuestionRow = {
  question_version_id: string;
  order_index: number;
  question_versions:
    | DiagnosticQuestionVersionRow
    | DiagnosticQuestionVersionRow[]
    | null;
};

type DiagnosticEvidenceRow = {
  question_version_id: string;
  validation_status: string;
  validation_justification: string | null;
};

const diagnosticQuestionVersionRowSchema = z.object({
  axis_id: z.string(),
  axis_name: z.string(),
  section_id: z.string(),
  section_name: z.string(),
  section_order: z.number(),
  prompt: z.string(),
  evidence_parameter: z.unknown(),
  fami_enabled: z.boolean(),
  applies_to_respondent: z.boolean(),
}).passthrough();

const diagnosticQuestionRowSchema = z.object({
  question_version_id: z.string(),
  order_index: z.number(),
  question_versions: z.union([
    diagnosticQuestionVersionRowSchema,
    z.array(diagnosticQuestionVersionRowSchema),
  ]).nullable(),
}).passthrough();

const diagnosticResponseRowSchema = z.object({
  question_version_id: z.string(),
  answer: z.enum(["yes", "no", "not_applicable"]),
  is_not_applicable: z.boolean(),
  na_justification: z.string().nullable(),
  na_original_justification: z.string().nullable(),
  na_rejection_reason: z.string().nullable(),
}).passthrough();

const diagnosticEvidenceRowSchema = z.object({
  question_version_id: z.string(),
  validation_status: z.string(),
  validation_justification: z.string().nullable(),
}).passthrough();

const REPORT_AXIS_ORDER = ["Governanca", "Ambiental", "Social"] as const;

function reportAxisSortKey(name: string): number {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const index = REPORT_AXIS_ORDER.indexOf(normalized as (typeof REPORT_AXIS_ORDER)[number]);
  return index < 0 ? REPORT_AXIS_ORDER.length : index;
}

function evidenceStatusForReport(
  statuses: string[],
  requiresEvidence: boolean,
): ReportEvidenceStatus {
  if (!requiresEvidence && statuses.length === 0) return "not_required";
  if (statuses.includes("approved")) return "approved";
  if (statuses.includes("adjustment_requested")) return "adjustment_requested";
  if (statuses.includes("invalidated")) return "invalidated";
  if (statuses.length > 0) return "pending";
  return requiresEvidence ? "missing" : "not_required";
}

function diagnosticResultForReport(params: {
  answer: DiagnosticResponseRow["answer"] | null;
  isNotApplicable: boolean;
  waived: boolean;
  requiresEvidence: boolean;
  evidenceStatus: ReportEvidenceStatus;
}): ReportDiagnosticResult {
  if (params.waived) return "waived";
  if (!params.answer) throw new Error("report_diagnostic_snapshot_missing");
  if (params.isNotApplicable || params.answer === "not_applicable") return "not_applicable";
  if (params.answer === "no") return "not_attended";
  if (params.requiresEvidence && params.evidenceStatus !== "approved") {
    return "insufficient_evidence";
  }
  return "attended";
}

/**
 * Reconstrói o diagnóstico a partir da estrutura congelada da versão publicada
 * e sobrepõe os snapshots do processamento. Critérios dispensados continuam
 * presentes mesmo quando legitimamente não possuem resposta.
 */
export function buildReportDiagnostic(params: {
  questions: DiagnosticQuestionRow[];
  responses: DiagnosticResponseRow[];
  evidences: DiagnosticEvidenceRow[];
  waivedQuestionVersionIds: Set<string>;
}): ReportDiagnostic {
  const statusesByQuestion = new Map<string, string[]>();
  const justificationsByQuestion = new Map<string, string[]>();
  for (const evidence of params.evidences) {
    const statuses = statusesByQuestion.get(evidence.question_version_id) ?? [];
    statuses.push(evidence.validation_status);
    statusesByQuestion.set(evidence.question_version_id, statuses);
    const justification = evidence.validation_justification?.trim();
    if (justification) {
      const values = justificationsByQuestion.get(evidence.question_version_id) ?? [];
      if (!values.includes(justification)) values.push(justification);
      justificationsByQuestion.set(evidence.question_version_id, values);
    }
  }
  const questionIds = new Set(params.questions.map((question) => question.question_version_id));
  if (questionIds.size !== params.questions.length) {
    throw new Error("report_diagnostic_duplicate_question");
  }
  for (const response of params.responses) {
    if (!questionIds.has(response.question_version_id)) {
      throw new Error("report_diagnostic_snapshot_outside_form_version");
    }
  }
  for (const evidence of params.evidences) {
    if (!questionIds.has(evidence.question_version_id)) {
      throw new Error("report_diagnostic_evidence_outside_form_version");
    }
  }
  for (const waivedId of params.waivedQuestionVersionIds) {
    if (!questionIds.has(waivedId)) {
      throw new Error("report_diagnostic_waiver_outside_form_version");
    }
  }

  const responsesByQuestion = new Map(
    params.responses.map((response) => [response.question_version_id, response]),
  );
  if (responsesByQuestion.size !== params.responses.length) {
    throw new Error("report_diagnostic_duplicate_response_snapshot");
  }

  const criteria: ReportDiagnosticCriterion[] = [];
  for (const question of params.questions) {
    const questionVersion = first(question.question_versions);
    if (!questionVersion) continue;
    const response = responsesByQuestion.get(question.question_version_id) ?? null;
    const statuses = statusesByQuestion.get(question.question_version_id) ?? [];
    const requiresEvidence = isEvidenceRequired({
      evidence_parameter: questionVersion.evidence_parameter,
    });
    const evidenceStatus = evidenceStatusForReport(statuses, requiresEvidence);
    const waived =
      params.waivedQuestionVersionIds.has(question.question_version_id) ||
      questionVersion.applies_to_respondent === false;

    criteria.push({
      questionVersionId: question.question_version_id,
      axisId: questionVersion.axis_id,
      axisName: questionVersion.axis_name,
      sectionId: questionVersion.section_id,
      sectionName: questionVersion.section_name,
      sectionOrder: Number(questionVersion.section_order ?? 0),
      orderIndex: Number(question.order_index ?? 0),
      prompt: questionVersion.prompt,
      answer: response?.answer ?? null,
      requiresEvidence,
      evidenceCount: statuses.length,
      evidenceStatus,
      evidenceJustifications: justificationsByQuestion.get(question.question_version_id) ?? [],
      result: diagnosticResultForReport({
        answer: response?.answer ?? null,
        isNotApplicable: response?.is_not_applicable === true,
        waived,
        requiresEvidence,
        evidenceStatus,
      }),
      notApplicableJustification: response?.na_original_justification ?? response?.na_justification ?? null,
      notApplicableRejectionReason: response?.na_rejection_reason ?? null,
    });
  }

  criteria.sort(
    (a, b) =>
      reportAxisSortKey(a.axisName) - reportAxisSortKey(b.axisName) ||
      a.axisName.localeCompare(b.axisName, "pt-BR") ||
      a.sectionOrder - b.sectionOrder ||
      a.sectionName.localeCompare(b.sectionName, "pt-BR") ||
      a.orderIndex - b.orderIndex ||
      a.prompt.localeCompare(b.prompt, "pt-BR"),
  );

  const count = (result: ReportDiagnosticResult) =>
    criteria.filter((criterion) => criterion.result === result).length;
  const axisBuckets = new Map<string, ReportDiagnostic["byAxis"][number]>();
  for (const criterion of criteria) {
    const bucket = axisBuckets.get(criterion.axisId) ?? {
      axisId: criterion.axisId,
      axisName: criterion.axisName,
      total: 0,
      evaluated: 0,
      attended: 0,
      notAttended: 0,
      insufficientEvidence: 0,
      notApplicable: 0,
      waived: 0,
    };
    bucket.total += 1;
    if (criterion.result === "waived") bucket.waived += 1;
    else {
      bucket.evaluated += 1;
      if (criterion.result === "attended") bucket.attended += 1;
      else if (criterion.result === "not_attended") bucket.notAttended += 1;
      else if (criterion.result === "insufficient_evidence") bucket.insufficientEvidence += 1;
      else bucket.notApplicable += 1;
    }
    axisBuckets.set(criterion.axisId, bucket);
  }

  const waived = count("waived");
  return {
    criteria,
    summary: {
      total: criteria.length,
      evaluated: criteria.length - waived,
      attended: count("attended"),
      notAttended: count("not_attended"),
      insufficientEvidence: count("insufficient_evidence"),
      notApplicable: count("not_applicable"),
      waived,
    },
    byAxis: [...axisBuckets.values()].sort(
      (a, b) =>
        reportAxisSortKey(a.axisName) - reportAxisSortKey(b.axisName) ||
        a.axisName.localeCompare(b.axisName, "pt-BR"),
    ),
  };
}

export async function loadCycleDiagnosticResults(
  supabase: SupabaseClient,
  params: { cycleProcessingId: string; formVersionId: string },
): Promise<ReportDiagnostic> {
  const [questionsResult, responsesResult, evidencesResult, waiversResult] = await Promise.all([
    supabase
      .from("form_questions")
      .select(
        "question_version_id, order_index, " +
          "question_versions!inner(axis_id, axis_name, section_id, section_name, section_order, prompt, evidence_parameter, fami_enabled, applies_to_respondent)",
      )
      .eq("form_version_id", params.formVersionId),
    supabase
      .from("response_snapshots")
      .select("question_version_id, answer, is_not_applicable, na_justification, na_original_justification, na_rejection_reason")
      .eq("cycle_processing_id", params.cycleProcessingId),
    supabase
      .from("evidence_snapshots")
      .select("question_version_id, validation_status, validation_justification")
      .eq("cycle_processing_id", params.cycleProcessingId),
    supabase
      .from("processing_waiver_snapshots")
      .select("question_version_id")
      .eq("cycle_processing_id", params.cycleProcessingId),
  ]);
  if (questionsResult.error) throw questionsResult.error;
  if (responsesResult.error) throw responsesResult.error;
  if (evidencesResult.error) throw evidencesResult.error;
  if (waiversResult.error) throw waiversResult.error;

  return buildReportDiagnostic({
    questions: z.array(diagnosticQuestionRowSchema).parse(questionsResult.data ?? []),
    responses: z.array(diagnosticResponseRowSchema).parse(responsesResult.data ?? []),
    evidences: z.array(diagnosticEvidenceRowSchema).parse(evidencesResult.data ?? []),
    waivedQuestionVersionIds: new Set(
      (waiversResult.data ?? []).map((row) => String(row.question_version_id)),
    ),
  });
}
