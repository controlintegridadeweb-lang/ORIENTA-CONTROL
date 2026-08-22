import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { SubmissionQuestion } from "@/shared/domain/submission";
import { isEvidenceRequired } from "@/shared/domain/evidence-parameter";
import { isEffectiveNotApplicable } from "@/shared/domain/not-applicable";
import { summarizeRespondentCorrectionResolution } from "@/shared/domain/respondent-correction-resolution";
import { adminProofStatusSchema } from "@/shared/domain/admin-proof-status";
import { chunkValues } from "@/infrastructure/supabase/pagination";

const expectedSubmissionQuestionSchema = z.object({
  form_version_id: z.string().min(1),
  question_version_id: z.string().min(1),
  question_versions: z.object({
    question_id: z.string().min(1),
    applies_to_respondent: z.boolean(),
    fami_enabled: z.boolean(),
    evidence_parameter: z.unknown(),
  }),
});
const submissionResponseSchema = z.object({
  id: z.string().min(1),
  cycle_id: z.string().min(1),
  question_version_id: z.string().min(1),
  answer: z.enum(["yes", "no", "not_applicable"]),
  is_not_applicable: z.boolean(),
  na_validation_status: z
    .enum(["pending", "approved", "rejected"])
    .nullable()
    .optional(),
  admin_applicability_status: z
    .literal("not_applicable")
    .nullable()
    .optional(),
  admin_proof_status: adminProofStatusSchema.nullable().optional(),
  updated_at: z.string(),
});
const evidenceReferenceSchema = z.object({
  id: z.string().min(1),
  response_id: z.string().min(1),
  validation_status: z.enum([
    "pending",
    "approved",
    "invalidated",
    "adjustment_requested",
  ]),
  validated_at: z.string().nullable(),
  submitted_at: z.string(),
});
const waiverReferenceSchema = z.object({
  organization_id: z.string().min(1),
  question_id: z.string().min(1),
});

type ExpectedSubmissionQuestion = z.infer<
  typeof expectedSubmissionQuestionSchema
>;
type SubmissionResponseReference = z.infer<
  typeof submissionResponseSchema
>;
type SubmissionEvidenceReference = z.infer<
  typeof evidenceReferenceSchema
>;

export type SubmissionCycleContext = {
  cycleId: string;
  formVersionId: string;
  organizationId: string;
};

export type SubmissionCycleSnapshot = {
  questions: SubmissionQuestion[];
  responses: SubmissionResponseReference[];
  evidences: SubmissionEvidenceReference[];
};

const EMPTY_SNAPSHOT: SubmissionCycleSnapshot = {
  questions: [],
  responses: [],
  evidences: [],
};

async function loadExpectedQuestions(
  supabase: SupabaseClient,
  formVersionIds: string[],
): Promise<ExpectedSubmissionQuestion[]> {
  const rows: ExpectedSubmissionQuestion[] = [];
  for (const ids of chunkValues(formVersionIds)) {
    const { data, error } = await supabase
      .from("form_questions")
      .select(
        "form_version_id, question_version_id, " +
          "question_versions!inner(question_id, applies_to_respondent, fami_enabled, evidence_parameter)",
      )
      .in("form_version_id", ids);
    if (error) throw error;
    rows.push(...z.array(expectedSubmissionQuestionSchema).parse(data ?? []));
  }
  return rows;
}

async function loadResponses(
  supabase: SupabaseClient,
  cycleIds: string[],
): Promise<SubmissionResponseReference[]> {
  const rows: SubmissionResponseReference[] = [];
  for (const ids of chunkValues(cycleIds)) {
    const { data, error } = await supabase
      .from("responses")
      .select(
        "id, cycle_id, question_version_id, answer, is_not_applicable, na_validation_status, admin_applicability_status, admin_proof_status, updated_at",
      )
      .in("cycle_id", ids);
    if (error) throw error;
    rows.push(...z.array(submissionResponseSchema).parse(data ?? []));
  }
  return rows;
}

async function loadEvidences(
  supabase: SupabaseClient,
  responseIds: string[],
): Promise<SubmissionEvidenceReference[]> {
  if (responseIds.length === 0) return [];
  const rows: SubmissionEvidenceReference[] = [];
  for (const ids of chunkValues(responseIds)) {
    const { data, error } = await supabase
      .from("evidences")
      .select("id, response_id, validation_status, validated_at, submitted_at")
      .in("response_id", ids)
      .is("deactivated_at", null);
    if (error) throw error;
    rows.push(...z.array(evidenceReferenceSchema).parse(data ?? []));
  }
  return rows;
}

async function loadWaivers(
  supabase: SupabaseClient,
  organizationIds: string[],
): Promise<Map<string, Set<string>>> {
  const questionsByOrganization = new Map<string, Set<string>>();
  for (const ids of chunkValues(organizationIds)) {
    const { data, error } = await supabase
      .from("question_organization_waivers")
      .select("organization_id, question_id")
      .in("organization_id", ids);
    if (error) throw error;
    for (const row of z.array(waiverReferenceSchema).parse(data ?? [])) {
      const questionIds =
        questionsByOrganization.get(row.organization_id) ?? new Set<string>();
      questionIds.add(row.question_id);
      questionsByOrganization.set(row.organization_id, questionIds);
    }
  }
  return questionsByOrganization;
}

function groupBy<T>(rows: T[], keyOf: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  }
  return grouped;
}

function buildQuestions(
  expected: ExpectedSubmissionQuestion[],
  responses: SubmissionResponseReference[],
  evidences: SubmissionEvidenceReference[],
  waivedQuestionIds: Set<string>,
): SubmissionQuestion[] {
  const responseByQuestionVersion = new Map(
    responses.map((response) => [response.question_version_id, response]),
  );
  const evidencesByResponse = groupBy(
    evidences,
    (evidence) => evidence.response_id,
  );

  return expected.map((row) => {
    const questionVersion = row.question_versions;
    const response = responseByQuestionVersion.get(row.question_version_id);
    const responseEvidences = response
      ? (evidencesByResponse.get(response.id) ?? [])
      : [];
    const proofRequested = response?.admin_proof_status === "proof_requested";
    const hasPendingEvidence = responseEvidences.some(
      (evidence) => evidence.validation_status === "pending",
    );
    const adjustmentResolution = summarizeRespondentCorrectionResolution({
      evidences: responseEvidences.map((evidence) => ({
        id: evidence.id,
        validationStatus: evidence.validation_status,
        validatedAt: evidence.validated_at,
        submittedAt: evidence.submitted_at,
      })),
      proofRequested,
      hasPendingEvidence,
    });
    const validationStatus = adjustmentResolution.hasAdjustmentRequest
      ? "adjustment_requested"
      : hasPendingEvidence
        ? "pending"
        : responseEvidences.some((evidence) => evidence.validation_status === "approved")
          ? "approved"
          : responseEvidences.at(-1)?.validation_status;

    return {
      questionId: questionVersion.question_id,
      appliesToRespondent: questionVersion.applies_to_respondent,
      isNotApplicable: isEffectiveNotApplicable({
        answer: response?.answer,
        naValidationStatus: response?.na_validation_status ?? null,
        adminApplicabilityStatus:
          response?.admin_applicability_status ?? null,
      }),
      hasWaiver: waivedQuestionIds.has(questionVersion.question_id),
      famiEnabled: questionVersion.fami_enabled,
      requiresEvidence: isEvidenceRequired({
        evidence_parameter: questionVersion.evidence_parameter,
      }),
      answer: response?.answer ?? null,
      hasActiveEvidence: responseEvidences.length > 0,
      validationStatus,
      proofRequested,
      adjustmentRequestCount: adjustmentResolution.requestedCount,
      resolvedAdjustmentRequestCount: adjustmentResolution.resolvedCount,
      unresolvedAdjustmentRequestCount: adjustmentResolution.unresolvedCount,
      hasResolvedAllAdjustments: adjustmentResolution.hasResolvedAllAdjustments,
    };
  });
}

/**
 * Carrega a prontidão de vários ciclos em um número constante de consultas por
 * tabela, em vez de repetir o mesmo conjunto de leituras para cada diagnóstico.
 */
export async function collectSubmissionSnapshots(
  supabase: SupabaseClient,
  contexts: SubmissionCycleContext[],
): Promise<Map<string, SubmissionCycleSnapshot>> {
  const uniqueContexts = Array.from(
    new Map(contexts.map((context) => [context.cycleId, context])).values(),
  );
  if (uniqueContexts.length === 0) return new Map();

  const formVersionIds = [
    ...new Set(uniqueContexts.map((context) => context.formVersionId)),
  ];
  const cycleIds = uniqueContexts.map((context) => context.cycleId);
  const organizationIds = [
    ...new Set(uniqueContexts.map((context) => context.organizationId)),
  ];

  const [expectedRows, responseRows, waiversByOrganization] = await Promise.all(
    [
      loadExpectedQuestions(supabase, formVersionIds),
      loadResponses(supabase, cycleIds),
      loadWaivers(supabase, organizationIds),
    ],
  );
  const evidenceRows = await loadEvidences(
    supabase,
    responseRows.map((response) => response.id),
  );

  const expectedByVersion = groupBy(expectedRows, (row) => row.form_version_id);
  const responsesByCycle = groupBy(responseRows, (row) => row.cycle_id);
  const evidencesByResponse = groupBy(evidenceRows, (row) => row.response_id);
  const snapshots = new Map<string, SubmissionCycleSnapshot>();

  for (const context of uniqueContexts) {
    const responses = responsesByCycle.get(context.cycleId) ?? [];
    const evidences = responses.flatMap(
      (response) => evidencesByResponse.get(response.id) ?? [],
    );
    snapshots.set(context.cycleId, {
      questions: buildQuestions(
        expectedByVersion.get(context.formVersionId) ?? [],
        responses,
        evidences,
        waiversByOrganization.get(context.organizationId) ?? new Set<string>(),
      ),
      responses,
      evidences,
    });
  }

  return snapshots;
}

/**
 * Coletor de PRONTIDÃO de envio de um ciclo. O caminho individual reutiliza o
 * mesmo carregador em lote para manter uma única regra de montagem.
 */
export async function collectSubmissionQuestions(
  supabase: SupabaseClient,
  cycleId: string,
): Promise<SubmissionQuestion[]> {
  const { data: cycle, error } = await supabase
    .from("cycles")
    .select("id, form_version_id, organization_id")
    .eq("id", cycleId)
    .maybeSingle();
  if (error) throw error;
  if (!cycle) throw new Error(`cycle_not_found: ${cycleId}`);

  const snapshots = await collectSubmissionSnapshots(supabase, [
    {
      cycleId,
      formVersionId: cycle.form_version_id as string,
      organizationId: cycle.organization_id as string,
    },
  ]);
  return snapshots.get(cycleId)?.questions ?? EMPTY_SNAPSHOT.questions;
}
