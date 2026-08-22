import type { SupabaseClient } from "@supabase/supabase-js";
import { isEligibleForFami } from "@/shared/domain/fami";
import type { AnswerValue, QuestionInput } from "@/shared/domain/types";

type QuestionVersionJoin = {
  fami_enabled: boolean | null;
  applies_to_respondent: boolean | null;
};

type FormQuestionRow = {
  question_version_id: string;
  question_versions: QuestionVersionJoin | QuestionVersionJoin[] | null;
};

type ResponseSnapshotRow = {
  question_version_id: string;
  answer: AnswerValue;
  is_not_applicable: boolean;
};

type WaiverSnapshotRow = { question_version_id: string };

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Metadados de perguntas calculados sobre o mesmo snapshot usado pelo FAMI.
 * Não consulta respostas, dispensas nem evidências vivas.
 */
export async function loadProcessingFamiQuestionMeta(
  client: SupabaseClient,
  params: { formVersionId: string; cycleProcessingId: string },
): Promise<{
  applicableQuestions: number;
  waivedQuestions: number;
  notApplicableResponses: number;
}> {
  const [questionsResult, responsesResult, waiversResult] = await Promise.all([
    client
      .from("form_questions")
      .select("question_version_id, question_versions!inner(fami_enabled, applies_to_respondent)")
      .eq("form_version_id", params.formVersionId),
    client
      .from("response_snapshots")
      .select("question_version_id, answer, is_not_applicable")
      .eq("cycle_processing_id", params.cycleProcessingId),
    client
      .from("processing_waiver_snapshots")
      .select("question_version_id")
      .eq("cycle_processing_id", params.cycleProcessingId),
  ]);

  if (questionsResult.error) throw questionsResult.error;
  if (responsesResult.error) throw responsesResult.error;
  if (waiversResult.error) throw waiversResult.error;

  const responsesByQuestionVersion = new Map(
    ((responsesResult.data ?? []) as ResponseSnapshotRow[]).map((response) => [
      response.question_version_id,
      response,
    ]),
  );
  const waivedQuestionVersionIds = new Set(
    ((waiversResult.data ?? []) as WaiverSnapshotRow[]).map(
      (waiver) => waiver.question_version_id,
    ),
  );

  let applicableQuestions = 0;
  let waivedQuestions = 0;
  let notApplicableResponses = 0;

  for (const raw of (questionsResult.data ?? []) as FormQuestionRow[]) {
    const questionVersion = first(raw.question_versions);
    if (!questionVersion) continue;
    const response = responsesByQuestionVersion.get(raw.question_version_id);
    const waived = waivedQuestionVersionIds.has(raw.question_version_id);
    const isNotApplicable = response?.is_not_applicable === true;
    const question: QuestionInput = {
      id: raw.question_version_id,
      axisId: "",
      sectionId: "",
      famiEnabled: questionVersion.fami_enabled ?? true,
      appliesToRespondent: questionVersion.applies_to_respondent ?? true,
      requiresEvidence: false,
      answer: response?.answer ?? "no",
      isNotApplicable,
      waived,
    };

    if (isEligibleForFami(question)) {
      applicableQuestions += 1;
      continue;
    }

    // Contagens auxiliares só consideram perguntas que pertencem ao universo
    // FAMI. Assim, o card de perguntas aplicáveis reproduz o denominador real.
    if (!question.famiEnabled || question.appliesToRespondent === false) continue;
    if (waived) waivedQuestions += 1;
    else if (isNotApplicable) notApplicableResponses += 1;
  }

  return { applicableQuestions, waivedQuestions, notApplicableResponses };
}
