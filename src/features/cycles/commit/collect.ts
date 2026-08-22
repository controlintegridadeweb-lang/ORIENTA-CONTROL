import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  adminProofStatusSchema,
  type AdminProofStatusValue,
} from "@/shared/domain/admin-proof-status";
import type { QuestionInput } from "@/shared/domain/types";
import { isEvidenceRequired } from "@/shared/domain/evidence-parameter";

export type CollectedProcessingSnapshot = {
  cycleId: string;
  cycleProcessingId: string;
  questions: QuestionInput[];
};

type QuestionVersionStructure = {
  question_id: string;
  section_id: string;
  axis_id: string;
  fami_enabled: boolean;
  applies_to_respondent: boolean;
  evidence_parameter: unknown;
};

export type ExpectedQuestionSnapshot = {
  question_version_id: string;
  question_versions: QuestionVersionStructure;
};

export type ProcessingResponseSnapshot = {
  question_version_id: string;
  answer: "yes" | "no" | "not_applicable";
  is_not_applicable: boolean;
  admin_proof_status?: AdminProofStatusValue | null;
};

export type ProcessingEvidenceSnapshot = {
  question_version_id: string;
  validation_status: string;
};

const questionVersionStructureSchema = z.object({
  question_id: z.string().min(1),
  section_id: z.string().min(1),
  axis_id: z.string().min(1),
  fami_enabled: z.boolean(),
  applies_to_respondent: z.boolean(),
  evidence_parameter: z.unknown(),
});

const expectedQuestionSchema = z.object({
  question_version_id: z.string().min(1),
  question_versions: questionVersionStructureSchema,
});

const processingResponseSnapshotSchema = z.object({
  question_version_id: z.string().min(1),
  answer: z.enum(["yes", "no", "not_applicable"]),
  is_not_applicable: z.boolean(),
  admin_proof_status: adminProofStatusSchema.nullable().optional(),
});

const processingEvidenceSnapshotSchema = z.object({
  question_version_id: z.string().min(1),
  validation_status: z.string(),
});

/**
 * Reconstitui um diagnóstico histórico pela estrutura congelada da versão do
 * formulário e pelos snapshots do processamento concluído.
 *
 * A estrutura é indispensável: critérios dispensados, N/A aprovados e seções
 * sem resposta persistida continuam existindo como escopos de denominador zero.
 * Nenhuma tabela operacional viva de resposta, evidência ou dispensa é usada.
 */
export async function collectProcessingSnapshot(
  supabase: SupabaseClient,
  params: { cycleId: string; cycleProcessingId: string },
): Promise<CollectedProcessingSnapshot> {
  const { data: processing, error: processingErr } = await supabase
    .from("cycle_processings")
    .select("id, cycle_id, status")
    .eq("id", params.cycleProcessingId)
    .eq("cycle_id", params.cycleId)
    .eq("status", "completed")
    .maybeSingle();
  if (processingErr) throw processingErr;
  if (!processing) {
    throw new Error("fami_processing_not_found: processamento concluído não pertence ao ciclo.");
  }

  const { data: cycle, error: cycleErr } = await supabase
    .from("cycles")
    .select("form_version_id")
    .eq("id", params.cycleId)
    .maybeSingle();
  if (cycleErr) throw cycleErr;
  if (!cycle) throw new Error("fami_cycle_not_found: diagnóstico histórico não encontrado.");

  const { data: expectedData, error: expectedErr } = await supabase
    .from("form_questions")
    .select(
      "question_version_id, " +
        "question_versions!inner(question_id, section_id, axis_id, fami_enabled, applies_to_respondent, evidence_parameter)",
    )
    .eq("form_version_id", cycle.form_version_id);
  if (expectedErr) throw expectedErr;
  const expectedQuestions = z.array(expectedQuestionSchema).parse(expectedData ?? []);

  const { data: responseData, error: responseErr } = await supabase
    .from("response_snapshots")
    .select(
      "question_version_id, answer, is_not_applicable, admin_proof_status",
    )
    .eq("cycle_processing_id", params.cycleProcessingId);
  if (responseErr) throw responseErr;
  const responses = z.array(processingResponseSnapshotSchema).parse(responseData ?? []);

  const { data: evidenceData, error: evidenceErr } = await supabase
    .from("evidence_snapshots")
    .select("question_version_id, validation_status")
    .eq("cycle_processing_id", params.cycleProcessingId);
  if (evidenceErr) throw evidenceErr;
  const evidences = z.array(processingEvidenceSnapshotSchema).parse(evidenceData ?? []);

  const { data: waiverData, error: waiverErr } = await supabase
    .from("processing_waiver_snapshots")
    .select("question_version_id")
    .eq("cycle_processing_id", params.cycleProcessingId);
  if (waiverErr) throw waiverErr;
  const waivedQuestionVersionIds = new Set(
    (waiverData ?? []).map((waiver) => String(waiver.question_version_id)),
  );

  return assembleProcessingSnapshot({
    cycleId: params.cycleId,
    cycleProcessingId: params.cycleProcessingId,
    expectedQuestions,
    responses,
    evidences,
    waivedQuestionVersionIds,
  });
}

/** Função pura da reconstrução histórica usada pela conferência FAMI. */
export function assembleProcessingSnapshot(input: {
  cycleId: string;
  cycleProcessingId: string;
  expectedQuestions: ExpectedQuestionSnapshot[];
  responses: ProcessingResponseSnapshot[];
  evidences: ProcessingEvidenceSnapshot[];
  waivedQuestionVersionIds: Set<string>;
}): CollectedProcessingSnapshot {
  const expectedIds = new Set(input.expectedQuestions.map((row) => row.question_version_id));
  const responseByQuestionVersion = new Map<string, ProcessingResponseSnapshot>();
  for (const response of input.responses) {
    if (!expectedIds.has(response.question_version_id)) {
      throw new Error(`snapshot_question_outside_form: ${response.question_version_id}`);
    }
    if (responseByQuestionVersion.has(response.question_version_id)) {
      throw new Error(`duplicate_response_snapshot: ${response.question_version_id}`);
    }
    responseByQuestionVersion.set(response.question_version_id, response);
  }

  const statusesByQuestionVersion = new Map<string, string[]>();
  for (const evidence of input.evidences) {
    if (!expectedIds.has(evidence.question_version_id)) {
      throw new Error(`snapshot_evidence_outside_form: ${evidence.question_version_id}`);
    }
    const list = statusesByQuestionVersion.get(evidence.question_version_id) ?? [];
    list.push(evidence.validation_status);
    statusesByQuestionVersion.set(evidence.question_version_id, list);
  }

  const questions: QuestionInput[] = input.expectedQuestions.map((expected) => {
    const questionVersion = expected.question_versions;
    const response = responseByQuestionVersion.get(expected.question_version_id);
    const statuses =
      statusesByQuestionVersion.get(expected.question_version_id) ?? [];
    const validationStatus = statuses.includes("approved")
      ? "approved"
      : statuses.includes("invalidated") &&
          !statuses.some(
            (status) =>
              status === "pending" || status === "adjustment_requested",
          )
        ? "invalidated"
        : statuses.length > 0
          ? "submitted"
          : undefined;

    return {
      id: questionVersion.question_id,
      questionVersionId: expected.question_version_id,
      axisId: questionVersion.axis_id,
      sectionId: questionVersion.section_id,
      famiEnabled: questionVersion.fami_enabled,
      requiresEvidence: isEvidenceRequired({
        evidence_parameter: questionVersion.evidence_parameter,
      }),
      answer: response?.answer ?? "no",
      validationStatus: validationStatus as QuestionInput["validationStatus"],
      adminProofStatus: response?.admin_proof_status ?? null,
      isNotApplicable: response?.is_not_applicable ?? false,
      waived: input.waivedQuestionVersionIds.has(expected.question_version_id),
      appliesToRespondent: questionVersion.applies_to_respondent,
      hasEvidence: statuses.length > 0,
    };
  });

  return {
    cycleId: input.cycleId,
    cycleProcessingId: input.cycleProcessingId,
    questions,
  };
}
