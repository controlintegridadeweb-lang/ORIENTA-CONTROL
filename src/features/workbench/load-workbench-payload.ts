import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { adminProofStatusSchema } from "@/shared/domain/admin-proof-status";
import { isEvidenceRequired } from "@/shared/domain/evidence-parameter";
import { resolveCycleOperationalScope } from "@/infrastructure/supabase/cycle-operational-scope";
import { isEffectiveNotApplicable } from "@/shared/domain/not-applicable";
import { summarizeRespondentCorrectionResolution } from "@/shared/domain/respondent-correction-resolution";

const nonEmptyString = z.string().trim().min(1);
const answerSchema = z.enum(["yes", "no", "not_applicable"]);

const workbenchFormSchema = z.object({
  id: nonEmptyString,
  name: z.string(),
});
const formVersionSchema = z.object({ version: z.number().int().nonnegative() });
const formQuestionJoinedSchema = z.object({
  order_index: z.number().int().nonnegative(),
  question_version_id: nonEmptyString,
  question_versions: z.object({
    question_id: nonEmptyString,
    prompt: z.string(),
    evidence_parameter: z.unknown(),
    fami_enabled: z.boolean(),
    applies_to_respondent: z.boolean(),
    section_name: z.string(),
    axis_name: z.string(),
  }),
});
const responseRowSchema = z.object({
  id: nonEmptyString,
  question_version_id: nonEmptyString,
  answer: answerSchema.nullable(),
  notes: z.string().nullable(),
  is_not_applicable: z.boolean().nullable(),
  na_justification: z.string().nullable().optional(),
  na_validation_status: z.enum(["pending", "approved", "rejected"]).nullable().optional(),
  na_rejection_reason: z.string().nullable().optional(),
  admin_applicability_status: z
    .literal("not_applicable")
    .nullable()
    .optional(),
  admin_proof_status: adminProofStatusSchema.nullable().optional(),
  admin_proof_observation: z.string().nullable().optional(),
  revision: z.number().int().positive(),
});
const evidenceRowSchema = z.object({
  id: nonEmptyString,
  response_id: nonEmptyString,
  kind: z.enum(["file", "link", "text"]),
  title: z.string().nullable().optional(),
  text_body: z.string().nullable().optional(),
  storage_path: z.string().nullable(),
  external_link: z.string().nullable(),
  link_reason: z.string().nullable(),
  original_filename: z.string().nullable(),
  validation_status: z.string().nullable(),
  validation_justification: z.string().nullable().optional(),
  validated_at: z.string().nullable().optional().default(null),
  submitted_at: z.string(),
});

export type WorkbenchEvidence = {
  id: string;
  kind: "file" | "link" | "text";
  title: string;
  description: string;
  externalLink: string | null;
  storagePath: string | null;
  textBody?: string | null;
  validationStatus: string | null;
  validatedAt: string | null;
  submittedAt: string;
  /** Justificativa do veredito (ajuste / não aprovação), quando houver. */
  validationJustification: string | null;
};

function mapWorkbenchEvidenceKind(
  kind: "file" | "link" | "text",
): WorkbenchEvidence["kind"] {
  return kind;
}

function mapWorkbenchEvidenceTitle(
  item: z.infer<typeof evidenceRowSchema>,
): string {
  if (item.kind === "text") {
    return item.title?.trim() || "Comprovação textual";
  }
  if (item.kind === "link") {
    return item.title?.trim() || item.link_reason?.trim() || item.external_link || "Link";
  }
  return item.title?.trim() || item.original_filename?.trim() || "Arquivo";
}

type WorkbenchForm = {
  id: string;
  name: string;
  version: number;
  state: string;
  responseDeadlineAt: string | null;
  closedAt: string | null;
};

export type WorkbenchRow = {
  questionId: string;
  /** Presente no payload carregado do servidor. */
  questionVersionId?: string;
  /** false quando a reabertura parcial não inclui este critério. */
  respondentEditable?: boolean;
  prompt: string;
  requiresEvidence: boolean;
  /** Critério entra no denominador/numerador do FAMI. */
  famiEnabled: boolean;
  recommendationText: string;
  axisName: string;
  sectionName: string;
  responseId: string | null;
  responseRevision?: number | null;
  answer: "yes" | "no" | "not_applicable" | null;
  notes: string | null;
  isNotApplicable: boolean;
  naJustification: string | null;
  naValidationStatus: "pending" | "approved" | "rejected" | null;
  naRejectionReason: string | null;
  evidenceId: string | null;
  evidenceTitle: string | null;
  evidenceDescription: string | null;
  externalLink: string | null;
  storagePath: string | null;
  textBody?: string | null;
  validationStatus: string | null;
  /** Justificativa do veredito atual (ajuste / não aprovação). */
  validationJustification: string | null;
  /** Há uma devolutiva administrativa ativa para esta pergunta. */
  hasAdjustmentRequest?: boolean;
  /** Solicitação administrativa de comprovação sem documento prévio. */
  proofRequested?: boolean;
  /** Orientação da solicitação de comprovação, quando houver. */
  proofRequestObservation?: string | null;
  /** Quantidade de evidências devolvidas nesta pergunta. */
  adjustmentRequestCount?: number;
  /** Quantidade de devolutivas já atendidas por evidências novas e distintas. */
  resolvedAdjustmentRequestCount?: number;
  /** Quantidade de devolutivas que ainda exigem uma nova evidência. */
  unresolvedAdjustmentRequestCount?: number;
  /** Todas as devolutivas desta pergunta já possuem substituição própria. */
  hasResolvedAllAdjustments?: boolean;
  /** Todas as evidências ativas do critério, da mais antiga para a mais nova. */
  evidences?: WorkbenchEvidence[];
};

/**
 * Carrega formulário, critérios congelados, respostas e evidências de um ciclo.
 * Todo join retornado pelo Supabase é validado antes de compor a tela.
 */
export async function loadWorkbenchPayload(
  supabase: SupabaseClient,
  cycleId: string,
): Promise<{
  form: WorkbenchForm;
  rows: WorkbenchRow[];
  cycle: { id: string; state: string };
}> {
  const scope = await resolveCycleOperationalScope(supabase, cycleId);
  if (!scope) {
    throw new Error("Diagnóstico não encontrado.");
  }
  const { cycle: cycleRow, formId } = scope;

  const [{ data: formData, error: formError }, { data: versionData, error: fvErr }] =
    await Promise.all([
      supabase.from("forms").select("id,name").eq("id", formId).single(),
      supabase
        .from("form_versions")
        .select("version")
        .eq("id", cycleRow.formVersionId)
        .single(),
    ]);
  if (formError) throw formError;
  if (fvErr) throw fvErr;

  const form = workbenchFormSchema.parse(formData);
  const version = formVersionSchema.parse(versionData);

  const { data: formQuestionData, error: fqErr } = await supabase
    .from("form_questions")
    .select(
      "order_index, question_version_id, " +
        "question_versions!inner(question_id, prompt, evidence_parameter, fami_enabled, applies_to_respondent, section_name, axis_name)",
    )
    .eq("form_version_id", cycleRow.formVersionId)
    .order("order_index", { ascending: true });
  if (fqErr) throw fqErr;

  const formQuestions = z.array(formQuestionJoinedSchema).parse(formQuestionData ?? []);
  const questionVersionIds = formQuestions.map((question) => question.question_version_id);

  const editableByQuestionVersion = new Map<string, boolean>();
  if (cycleRow.responseCollectionPausedAt) {
    for (const qv of questionVersionIds) {
      editableByQuestionVersion.set(qv, false);
    }
  } else if (cycleRow.state === "in_response" && cycleRow.reopenCount > 0) {
    const { data: reopenEvent, error: reopenEventError } = await supabase
      .from("cycle_reopen_events")
      .select("id")
      .eq("cycle_id", cycleRow.id)
      .eq("reopen_number", cycleRow.reopenCount)
      .maybeSingle();
    if (reopenEventError) throw reopenEventError;
    if (reopenEvent?.id) {
      const { data: allowed, error: allowedError } = await supabase
        .from("cycle_reopen_allowed_questions")
        .select("question_version_id")
        .eq("reopen_event_id", reopenEvent.id);
      if (allowedError) throw allowedError;
      const allowedIds = new Set(
        (allowed ?? []).map((row) => row.question_version_id as string),
      );
      if (allowedIds.size > 0) {
        for (const qv of questionVersionIds) {
          editableByQuestionVersion.set(qv, allowedIds.has(qv));
        }
      }
    }
  }

  const { data: responseData, error: responseError } =
    questionVersionIds.length > 0
      ? await supabase
          .from("responses")
          .select(
            "id, question_version_id, answer, notes, is_not_applicable, na_justification, na_validation_status, na_rejection_reason, admin_applicability_status, admin_proof_status, admin_proof_observation, revision",
          )
          .eq("cycle_id", cycleRow.id)
          .in("question_version_id", questionVersionIds)
      : { data: [], error: null };
  if (responseError) throw responseError;

  const responses = z.array(responseRowSchema).parse(responseData ?? []);
  const responseIds = responses.map((response) => response.id);

  const { data: evidenceData, error: evidenceError } =
    responseIds.length > 0
      ? await supabase
          .from("evidences")
          .select(
            "id, response_id, kind, title, text_body, storage_path, external_link, link_reason, original_filename, validation_status, validation_justification, validated_at, submitted_at",
          )
          .in("response_id", responseIds)
          .is("deactivated_at", null)
          .order("submitted_at", { ascending: true })
      : { data: [], error: null };
  if (evidenceError) throw evidenceError;

  const evidences = z.array(evidenceRowSchema).parse(evidenceData ?? []);
  const responseByQuestionVersion = new Map(
    responses.map((response) => [response.question_version_id, response] as const),
  );
  const evidenceByResponse = new Map<string, z.infer<typeof evidenceRowSchema>[]>();
  for (const evidence of evidences) {
    const current = evidenceByResponse.get(evidence.response_id) ?? [];
    current.push(evidence);
    evidenceByResponse.set(evidence.response_id, current);
  }

  const rows: WorkbenchRow[] = formQuestions
    .filter((question) => question.question_versions.applies_to_respondent)
    .map((question) => {
      const questionVersion = question.question_versions;
      const response = responseByQuestionVersion.get(question.question_version_id);
      const responseEvidences = response ? (evidenceByResponse.get(response.id) ?? []) : [];
      const evidence = responseEvidences.at(-1);
      const mappedEvidences: WorkbenchEvidence[] = responseEvidences.map((item) => ({
        id: item.id,
        kind: mapWorkbenchEvidenceKind(item.kind),
        title: mapWorkbenchEvidenceTitle(item),
        description: item.link_reason ?? "",
        externalLink: item.external_link,
        storagePath: item.storage_path,
        textBody: item.text_body ?? null,
        validationStatus: item.validation_status,
        validatedAt: item.validated_at,
        submittedAt: item.submitted_at,
        validationJustification: item.validation_justification?.trim() || null,
      }));
      const proofRequested = response?.admin_proof_status === "proof_requested";
      const hasPendingEvidence = mappedEvidences.some(
        (item) => item.validationStatus === "pending",
      );
      const adjustmentResolution = summarizeRespondentCorrectionResolution({
        evidences: mappedEvidences,
        proofRequested,
        hasPendingEvidence,
      });

      const feedbackJustification =
        [...mappedEvidences]
          .reverse()
          .find(
            (item) =>
              (item.validationStatus === "adjustment_requested" ||
                item.validationStatus === "invalidated") &&
              item.validationJustification,
          )?.validationJustification ?? null;

      return {
        questionId: questionVersion.question_id,
        questionVersionId: question.question_version_id,
        respondentEditable: editableByQuestionVersion.get(question.question_version_id) ?? true,
        prompt: questionVersion.prompt,
        requiresEvidence: isEvidenceRequired({
          evidence_parameter: questionVersion.evidence_parameter,
        }),
        famiEnabled: questionVersion.fami_enabled,
        recommendationText: "",
        axisName: questionVersion.axis_name,
        sectionName: questionVersion.section_name,
        responseId: response?.id ?? null,
        responseRevision: response?.revision ?? null,
        answer: response?.answer ?? null,
        notes: response?.notes ?? null,
        isNotApplicable: isEffectiveNotApplicable({
          answer: response?.answer,
          naValidationStatus: response?.na_validation_status ?? null,
          adminApplicabilityStatus:
            response?.admin_applicability_status ?? null,
        }),
        naJustification: response?.na_justification ?? response?.notes ?? null,
        naValidationStatus: response?.na_validation_status ?? null,
        naRejectionReason: response?.na_rejection_reason ?? null,
        evidenceId: evidence?.id ?? null,
        evidenceTitle: evidence ? mapWorkbenchEvidenceTitle(evidence) : null,
        evidenceDescription: evidence?.link_reason ?? null,
        externalLink: evidence?.external_link ?? null,
        storagePath: evidence?.storage_path ?? null,
        textBody: evidence?.text_body ?? null,
        validationStatus: evidence?.validation_status ?? null,
        validationJustification:
          feedbackJustification ??
          response?.admin_proof_observation?.trim() ??
          evidence?.validation_justification?.trim() ??
          null,
        proofRequested,
        proofRequestObservation:
          response?.admin_proof_observation?.trim() || null,
        hasAdjustmentRequest: adjustmentResolution.hasAdjustmentRequest,
        adjustmentRequestCount: adjustmentResolution.requestedCount,
        resolvedAdjustmentRequestCount: adjustmentResolution.resolvedCount,
        unresolvedAdjustmentRequestCount: adjustmentResolution.unresolvedCount,
        hasResolvedAllAdjustments: adjustmentResolution.hasResolvedAllAdjustments,
        evidences: mappedEvidences,
      };
    });

  return {
    form: {
      id: form.id,
      name: form.name,
      version: version.version,
      state: cycleRow.state,
      responseDeadlineAt: cycleRow.responseDeadlineAt,
      closedAt: cycleRow.closedAt,
    },
    rows,
    cycle: { id: cycleRow.id, state: cycleRow.state },
  };
}
