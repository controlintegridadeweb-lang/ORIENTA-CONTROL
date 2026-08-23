import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  absentEvidenceStatusFromProof,
  createAbsentEvidenceShell,
  deriveResponseEvidenceStatus,
  type EvidenceVerdict,
  type QueueEvidence,
  type QueueEvidenceGroup,
  type QueueNotApplicable,
} from "../queue-model";
import {
  classifyFormCriterion,
  FORM_VISUAL_STATUS_LABEL,
} from "../form-view-model";
import type { UnifiedFormCriterion } from "../contracts";
import {
  recommendationBindingsSchema,
  validationEvidenceRowSchema,
  validationResponseRowSchema,
} from "./validation-rpc-schemas";
import {
  loadValidationProfileNames,
  loadValidationQuestionOrder,
} from "./validation-read-support";
import { calculateFamiCriterion } from "@/shared/domain/fami";
import { inferRecommendationDetail } from "@/shared/domain/recommendation-engine";
import { isEffectiveNotApplicable } from "@/shared/domain/not-applicable";
import { loadActiveValidationAnalysisDrafts } from "../validation-analysis-draft-service";
import type { QueueAnalysisDraft } from "../queue-types";
import type { ValidationAnalysisDraft } from "../validation-analysis-draft";

function recommendationTextFromSnapshot(snapshot: unknown): string | null {
  const parsed = recommendationBindingsSchema.safeParse(snapshot ?? {});
  if (!parsed.success) return null;
  const recommendation = parsed.data.bindings?.defaultRecommendation;
  if (!recommendation) return null;
  return (
    recommendation.textoBaseFixo?.trim() ||
    recommendation.textoBaseParametrizavel?.trim() ||
    recommendation.title?.trim() ||
    null
  );
}

function requiresEvidenceFromParameter(parameter: unknown): boolean {
  if (!parameter || typeof parameter !== "object") return false;
  return (parameter as { required?: unknown }).required === true;
}

function toEvidenceVerdict(status: string): EvidenceVerdict {
  if (
    status === "approved" ||
    status === "invalidated" ||
    status === "adjustment_requested"
  ) {
    return status;
  }
  return "pending";
}

function toQueueAnalysisDraft(
  draft: ValidationAnalysisDraft | undefined,
): QueueAnalysisDraft | null {
  if (!draft) return null;
  return {
    id: draft.id,
    action: draft.action,
    justification: draft.justification,
    notes: draft.notes,
    revision: draft.revision,
    updatedAt: draft.updatedAt,
  };
}

function buildEvidenceGroup(
  response: z.infer<typeof validationResponseRowSchema>,
  documents: QueueEvidence[],
  orderIndex: number,
  names: Map<string, string>,
  absentProofDraft: QueueAnalysisDraft | null = null,
): QueueEvidenceGroup {
  const question = response.question_versions;
  const realDocuments = documents.filter((item) => !item.absentEvidence);
  const absentStatus = absentEvidenceStatusFromProof(response.admin_proof_status);
  const statusDocuments =
    realDocuments.length === 0
      ? [
          createAbsentEvidenceShell({
            responseId: response.id,
            questionPrompt: question.prompt,
            sectionId: question.section_id,
            sectionName: question.section_name,
            sectionOrder: question.section_order,
            axisId: question.axis_id,
            axisName: question.axis_name,
            orderIndex,
            answer: response.answer === "no" ? "no" : "yes",
            allowsNotApplicable: Boolean(question.allows_not_applicable),
            respondentNote: response.notes?.trim() || null,
            answeredByName: names.get(response.created_by) ?? null,
            answeredAt: response.updated_at || response.created_at,
            status: absentStatus,
            justification: response.admin_proof_observation?.trim() || null,
            adminProofObservation:
              response.admin_proof_observation?.trim() || null,
            validatedAt: response.admin_proof_decided_at ?? null,
            validatedByName: response.admin_proof_decided_by
              ? names.get(response.admin_proof_decided_by) ?? "Administração"
              : null,
          }),
        ]
      : documents;

  return {
    responseId: response.id,
    questionPrompt: question.prompt,
    sectionId: question.section_id,
    sectionName: question.section_name,
    sectionOrder: question.section_order,
    axisId: question.axis_id,
    axisName: question.axis_name,
    orderIndex,
    answer: response.answer === "no" ? "no" : "yes",
    respondentNote: response.notes?.trim() || null,
    answeredByName: names.get(response.created_by) ?? null,
    answeredAt: response.updated_at || response.created_at,
    allowsNotApplicable: Boolean(question.allows_not_applicable),
    adminProofObservation: response.admin_proof_observation?.trim() || null,
    adminProofDecidedAt: response.admin_proof_decided_at ?? null,
    adminProofDecidedByName: response.admin_proof_decided_by
      ? names.get(response.admin_proof_decided_by) ?? "Administração"
      : null,
    status:
      realDocuments.length === 0
        ? absentStatus
        : deriveResponseEvidenceStatus(statusDocuments),
    documents: realDocuments,
    analysisDraft: realDocuments.length === 0 ? absentProofDraft : null,
  };
}

function buildNotApplicableItem(
  response: z.infer<typeof validationResponseRowSchema>,
  documents: Array<{
    id: string;
    kind: "file" | "link" | "text";
    fileName: string | null;
    externalLink: string | null;
    title?: string | null;
    textBody?: string | null;
  }>,
  orderIndex: number,
  names: Map<string, string>,
  analysisDraft: QueueAnalysisDraft | null = null,
): QueueNotApplicable {
  const question = response.question_versions;
  const isAdmin = response.admin_applicability_status === "not_applicable";
  const status: QueueNotApplicable["status"] = isAdmin
    ? "approved"
    : response.answer === "no" && Boolean(question.allows_not_applicable)
      ? "pending"
      : response.na_validation_status === "approved"
        ? "approved"
        : response.na_validation_status === "rejected"
          ? "rejected"
          : "pending";

  return {
    id: response.id,
    responseId: response.id,
    questionPrompt: question.prompt,
    sectionId: question.section_id,
    sectionName: question.section_name,
    sectionOrder: question.section_order,
    axisId: question.axis_id,
    axisName: question.axis_name,
    orderIndex,
    justification: isAdmin
      ? response.admin_na_justification?.trim() ||
        response.na_justification?.trim() ||
        response.notes?.trim() ||
        ""
      : response.na_justification?.trim() || response.notes?.trim() || "",
    status,
    rejectionReason: response.na_rejection_reason,
    validatedAt: isAdmin
      ? response.admin_na_decided_at
      : status === "pending"
        ? null
        : response.na_validated_at,
    validatedByName: isAdmin
      ? response.admin_na_decided_by
        ? names.get(response.admin_na_decided_by) ?? "Administração"
        : null
      : response.na_validated_by
        ? names.get(response.na_validated_by) ?? "Administração"
        : null,
    source: isAdmin ? "admin" : "respondent",
    originalAnswer: response.answer,
    documents,
    analysisDraft,
  };
}

export async function hydrateValidationCriteria(
  supabase: SupabaseClient,
  cycleId: string,
  responseIds: string[],
): Promise<UnifiedFormCriterion[]> {
  if (responseIds.length === 0) return [];

  const orderByResponse = new Map(
    responseIds.map((id, index) => [id, index]),
  );

  const [
    { data: responseRows, error: responseError },
    { data: evidenceRows, error: evidenceError },
    orderByQuestion,
  ] = await Promise.all([
    supabase
      .from("responses")
      .select(
        "id, answer, notes, na_justification, na_validation_status, na_rejection_reason, " +
          "na_validated_at, na_validated_by, created_by, created_at, updated_at, " +
          "admin_applicability_status, admin_na_justification, admin_na_decided_at, admin_na_decided_by, " +
          "admin_proof_status, admin_proof_observation, admin_proof_decided_at, admin_proof_decided_by, " +
          "question_versions!inner(prompt, question_id, section_id, section_name, section_order, " +
          "axis_id, axis_name, allows_not_applicable, fami_enabled, evidence_parameter, library_binding_snapshot)",
      )
      .in("id", responseIds),
    supabase
      .from("evidences")
      .select(
        "id, response_id, kind, title, text_body, storage_path, external_link, link_reason, " +
          "original_filename, submitted_at, validation_status, validation_justification, " +
          "validated_at, validated_by",
      )
      .in("response_id", responseIds)
      .is("deactivated_at", null),
    loadValidationQuestionOrder(supabase, cycleId),
  ]);
  if (responseError) throw responseError;
  if (evidenceError) throw evidenceError;

  const responses = z.array(validationResponseRowSchema).parse(responseRows ?? []);
  const evidences = z.array(validationEvidenceRowSchema).parse(evidenceRows ?? []);
  const draftRows = await loadActiveValidationAnalysisDrafts(supabase, cycleId, {
    evidenceIds: evidences.map((row) => row.id),
    responseIds: responses.map((row) => row.id),
  });
  const evidenceDraftById = new Map(
    draftRows
      .filter((draft) => draft.targetKind === "evidence" && draft.evidenceId)
      .map((draft) => [draft.evidenceId!, draft]),
  );
  const responseDraftByKey = new Map(
    draftRows
      .filter((draft) => draft.targetKind !== "evidence" && draft.responseId)
      .map((draft) => [`${draft.targetKind}:${draft.responseId}`, draft]),
  );
  const names = await loadValidationProfileNames(
    supabase,
    [
      ...responses.map((row) => row.created_by),
      ...responses.map((row) => row.na_validated_by),
      ...responses.map((row) => row.admin_na_decided_by),
      ...responses.map((row) => row.admin_proof_decided_by),
      ...evidences.map((row) => row.validated_by),
    ].filter((id): id is string => Boolean(id)),
  );

  const evidenceByResponse = new Map<string, typeof evidences>();
  for (const evidence of evidences) {
    const list = evidenceByResponse.get(evidence.response_id) ?? [];
    list.push(evidence);
    evidenceByResponse.set(evidence.response_id, list);
  }

  const criteria: UnifiedFormCriterion[] = [];
  for (const response of responses) {
    const question = response.question_versions;
    const orderIndex =
      orderByQuestion.get(question.question_id) ?? Number.MAX_SAFE_INTEGER;
    const requiresEvidence = requiresEvidenceFromParameter(
      question.evidence_parameter,
    );
    const sourceDocuments = evidenceByResponse.get(response.id) ?? [];
    const evidenceCount = sourceDocuments.length;
    const documents: QueueEvidence[] = sourceDocuments.map((row) => {
      const title = row.title?.trim() || null;
      const textBody = row.text_body?.trim() || null;
      const fileName =
        row.kind === "text"
          ? title
          : row.original_filename ?? row.storage_path;
      return {
        id: row.id,
        responseId: row.response_id,
        questionPrompt: question.prompt,
        sectionId: question.section_id,
        sectionName: question.section_name,
        sectionOrder: question.section_order,
        axisId: question.axis_id,
        axisName: question.axis_name,
        orderIndex,
        kind: row.kind,
        title,
        textBody,
        fileName,
        externalLink: row.external_link,
        linkReason: row.link_reason,
        submittedAt: row.submitted_at,
        status: toEvidenceVerdict(row.validation_status),
        justification: row.validation_justification,
        validatedAt: row.validated_at,
        validatedByName: row.validated_by
          ? names.get(row.validated_by) ?? "Administração"
          : null,
        answer: response.answer === "no" ? "no" : "yes",
        allowsNotApplicable: Boolean(question.allows_not_applicable),
        respondentNote: response.notes?.trim() || null,
        answeredByName: names.get(response.created_by) ?? null,
        answeredAt: response.updated_at || response.created_at,
        analysisDraft: toQueueAnalysisDraft(evidenceDraftById.get(row.id)),
      };
    });

    let evidenceStatus: EvidenceVerdict | null = null;
    if (
      response.answer === "yes" &&
      requiresEvidence &&
      response.admin_applicability_status !== "not_applicable"
    ) {
      evidenceStatus =
        evidenceCount === 0
          ? absentEvidenceStatusFromProof(response.admin_proof_status)
          : deriveResponseEvidenceStatus(documents);
    } else if (
      response.answer === "no" &&
      response.admin_applicability_status !== "not_applicable" &&
      response.admin_proof_status
    ) {
      evidenceStatus = absentEvidenceStatusFromProof(response.admin_proof_status);
    }

    const classification = classifyFormCriterion({
      answer: response.answer,
      requiresEvidence,
      allowsNotApplicable: Boolean(question.allows_not_applicable),
      evidenceCount,
      evidenceStatus,
      naValidationStatus: response.na_validation_status,
      adminApplicabilityStatus: response.admin_applicability_status,
    });
    const effectiveNotApplicable = isEffectiveNotApplicable({
      answer: response.answer,
      naValidationStatus: response.na_validation_status,
      adminApplicabilityStatus: response.admin_applicability_status,
    });
    const hasApprovedEvidence =
      evidenceStatus === "approved" ||
      documents.some((item) => item.status === "approved");
    const isInsufficient =
      evidenceStatus === "invalidated" ||
      evidenceStatus === "considered_insufficient" ||
      response.admin_proof_status === "considered_insufficient";
    const score = calculateFamiCriterion({
      answer: effectiveNotApplicable ? "not_applicable" : response.answer,
      requiresEvidence,
      hasApprovedEvidence,
      isInsufficient,
      includedInCalculation:
        !effectiveNotApplicable && question.fami_enabled !== false,
    });
    const recommendationDetail = inferRecommendationDetail({
      answer: response.answer,
      requiresEvidence,
      validationStatus:
        evidenceStatus === "approved"
          ? "approved"
          : evidenceStatus === "invalidated" ||
              evidenceStatus === "considered_insufficient"
            ? "invalidated"
            : evidenceStatus === "adjustment_requested"
              ? "adjustment_requested"
              : evidenceStatus === "pending"
                ? "pending"
                : undefined,
      adminProofStatus: response.admin_proof_status,
      isNotApplicable: effectiveNotApplicable,
      famiEnabled: question.fami_enabled !== false,
      appliesToRespondent: true,
      waived: false,
      hasEvidence: evidenceCount > 0,
    });
    const isEvidenceAction =
      response.answer === "yes" &&
      requiresEvidence &&
      response.admin_applicability_status !== "not_applicable";
    const isNotApplicableAction =
      response.admin_applicability_status === "not_applicable" ||
      response.answer === "not_applicable";

    criteria.push({
      responseId: response.id,
      questionPrompt: question.prompt,
      sectionId: question.section_id,
      sectionName: question.section_name,
      sectionOrder: question.section_order,
      axisId: question.axis_id,
      axisName: question.axis_name,
      orderIndex,
      answer: response.answer,
      requiresEvidence,
      allowsNotApplicable: Boolean(question.allows_not_applicable),
      famiEnabled: question.fami_enabled !== false,
      respondentNote: response.notes?.trim() || null,
      naJustification: response.na_justification?.trim() || null,
      answeredByName: names.get(response.created_by) ?? null,
      answeredAt: response.updated_at || response.created_at,
      evidenceCount,
      evidenceStatus,
      validationNeed: classification.validationNeed,
      visualStatus: classification.visualStatus,
      visualStatusLabel: FORM_VISUAL_STATUS_LABEL[classification.visualStatus],
      awaitsAdminAction: classification.awaitsAdminAction,
      obtainedPoints: score.obtainedPoints,
      possiblePoints: score.possiblePoints,
      includedInCalculation: score.includedInCalculation,
      recommendationText: recommendationDetail
        ? recommendationTextFromSnapshot(question.library_binding_snapshot)
        : null,
      documents,
      evidenceGroup: isEvidenceAction
        ? buildEvidenceGroup(
            response,
            documents,
            orderIndex,
            names,
            toQueueAnalysisDraft(
              responseDraftByKey.get(`absent_proof:${response.id}`),
            ),
          )
        : null,
      notApplicableItem: isNotApplicableAction
        ? buildNotApplicableItem(
            response,
            documents.map((item) => ({
              id: item.id,
              kind: item.kind,
              fileName: item.fileName,
              externalLink: item.externalLink,
              title: item.title,
              textBody: item.textBody,
            })),
            orderIndex,
            names,
            toQueueAnalysisDraft(
              responseDraftByKey.get(
                response.admin_applicability_status === "not_applicable"
                  ? `admin_not_applicable:${response.id}`
                  : `not_applicable:${response.id}`,
              ),
            ),
          )
        : null,
      readonlyView: !isEvidenceAction && !isNotApplicableAction,
    });
  }

  return criteria.sort(
    (left, right) =>
      (orderByResponse.get(left.responseId) ?? 0) -
      (orderByResponse.get(right.responseId) ?? 0),
  );
}
