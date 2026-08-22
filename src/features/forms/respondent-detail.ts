import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { mapEmbeddedValidationToUi } from "@/features/evidences";
import { FormsNotFoundError } from "./admin-service";
import { deriveValidationStatus } from "./answers-status";
import { loadOrderedQuestionsForVersion, loadUserNames } from "./answers-queries";
import type {
  RespondentAnswerCell,
  RespondentContributor,
  RespondentDetail,
} from "./answers-types";

type Client = SupabaseClient;

const nonEmptyString = z.string().trim().min(1);

const cycleDetailRowSchema = z.object({
  id: nonEmptyString,
  organization_id: nonEmptyString,
  state: nonEmptyString,
  period_label: z.string(),
  form_version_id: nonEmptyString,
});

const organizationRowSchema = z.object({ id: nonEmptyString, name: z.string() });
const waiverRowSchema = z.object({ question_id: nonEmptyString, reason: z.string().nullable() });
const responseRowSchema = z.object({
  id: nonEmptyString,
  answer: z.enum(["yes", "no", "not_applicable"]).nullable(),
  notes: z.string().nullable(),
  updated_at: z.string(),
  created_at: z.string(),
  created_by: z.string().nullable(),
  is_not_applicable: z.boolean().nullable(),
  question_versions: z.object({ question_id: nonEmptyString }),
});
const evidenceRowSchema = z.object({
  id: nonEmptyString,
  response_id: nonEmptyString,
  kind: z.string(),
  external_link: z.string().nullable(),
  storage_path: z.string().nullable(),
  original_filename: z.string().nullable(),
  link_reason: z.string().nullable(),
  validation_status: z.string(),
});

/**
 * Monta o detalhe de um ciclo específico.
 *
 * Formulário, organização e versão de perguntas são derivados da execução
 * congelada. Assim, a tela não escolhe implicitamente o ciclo mais recente de
 * um mesmo formulário/órgão e preserva o histórico corretamente.
 */
export async function getRespondentDetail(
  client: Client,
  cycleId: string,
): Promise<RespondentDetail> {
  const { data: cycleData, error: cycleError } = await client
    .from("cycles")
    .select("id, organization_id, state, period_label, form_version_id")
    .eq("id", cycleId)
    .maybeSingle();
  if (cycleError) throw cycleError;
  if (!cycleData) throw new FormsNotFoundError("Diagnóstico não encontrado.");

  const cycle = cycleDetailRowSchema.parse(cycleData);
  const organizationId = cycle.organization_id;
  const orderedQuestions = await loadOrderedQuestionsForVersion(
    client,
    cycle.form_version_id,
  );
  const questionIds = orderedQuestions.map((question) => question.id);
  const cycleState = cycle.state;

  const [orgRes, waiversRes] = await Promise.all([
    client
      .from("organizations")
      .select("id,name")
      .eq("id", organizationId)
      .maybeSingle(),
    client
      .from("question_organization_waivers")
      .select("question_id,reason")
      .eq("organization_id", organizationId)
      .in("question_id", questionIds),
  ]);

  if (orgRes.error) throw orgRes.error;
  if (!orgRes.data) {
    throw new FormsNotFoundError("Organização não encontrada.");
  }
  const organization = organizationRowSchema.parse(orgRes.data);
  if (waiversRes.error) throw waiversRes.error;

  let responses: Array<z.infer<typeof responseRowSchema> & { question_id: string }> = [];

  if (questionIds.length > 0) {
    const { data, error } = await client
      .from("responses")
      .select(
        "id, answer, notes, updated_at, created_at, created_by, is_not_applicable, question_versions!inner(question_id)",
      )
      .eq("cycle_id", cycle.id);
    if (error) throw error;
    responses = z.array(responseRowSchema).parse(data ?? []).flatMap((response) => {
      const questionId = response.question_versions.question_id;
      if (!questionIds.includes(questionId)) return [];
      return [{ ...response, question_id: questionId }];
    });
  }

  const waiverByQuestion = new Map<string, string | null>();
  for (const waiver of z.array(waiverRowSchema).parse(waiversRes.data ?? [])) {
    waiverByQuestion.set(waiver.question_id, waiver.reason ?? null);
  }

  const responseIds = responses.map((response) => response.id);
  const evidencesRes =
    responseIds.length > 0
      ? await client
          .from("evidences")
          .select(
            "id, response_id, kind, external_link, storage_path, original_filename, link_reason, validation_status",
          )
          .in("response_id", responseIds)
          .is("deactivated_at", null)
      : { data: [], error: null };
  if (evidencesRes.error) throw evidencesRes.error;

  const evidences = z.array(evidenceRowSchema).parse(evidencesRes.data ?? []);

  const validationByEvidence = new Map<string, string>();
  for (const evidence of evidences) {
    validationByEvidence.set(
      evidence.id,
      mapEmbeddedValidationToUi(evidence.validation_status, cycleState),
    );
  }

  const evidencesByResponse = new Map<string, (typeof evidences)>();
  for (const evidence of evidences) {
    const current = evidencesByResponse.get(evidence.response_id) ?? [];
    current.push(evidence);
    evidencesByResponse.set(evidence.response_id, current);
  }

  const hasComplementationRequested = cycleState === "awaiting_adjustment";
  const responseByQuestion = new Map(
    responses.map((response) => [response.question_id, response] as const),
  );

  const userIds = new Set<string>();
  for (const response of responses) {
    if (response.created_by) userIds.add(response.created_by);
  }
  const userNames = await loadUserNames(client, Array.from(userIds));

  const answers: RespondentAnswerCell[] = orderedQuestions.map((question) => {
    const response = responseByQuestion.get(question.id);
    const responseEvidences = response
      ? evidencesByResponse.get(response.id) ?? []
      : [];
    const isWaived = waiverByQuestion.has(question.id);
    const waiverReason = isWaived ? waiverByQuestion.get(question.id) ?? null : null;
    const isNotApplicable = response?.is_not_applicable === true;

    return {
      questionId: question.id,
      orderIndex: question.orderIndex,
      prompt: question.prompt,
      answerType: "yes_no",
      answer: response?.answer ?? null,
      notes: response?.notes ?? null,
      updatedAt: response?.updated_at ?? null,
      createdByUserId: response?.created_by ?? null,
      createdByName: response?.created_by
        ? userNames.get(response.created_by) ?? null
        : null,
      isWaived,
      waiverReason,
      isNotApplicable,
      requiresEvidence: question.requiresEvidence,
      famiEnabled: question.famiEnabled,
      evidences: responseEvidences.map((evidence) => {
        const title =
          evidence.kind === "file"
            ? evidence.original_filename ?? evidence.storage_path ?? "Arquivo"
            : evidence.external_link ?? "Link";
        return {
            id: evidence.id,
            title,
            description: evidence.link_reason,
            externalLink: evidence.external_link,
            storagePath: evidence.storage_path,
            validationStatus: validationByEvidence.get(evidence.id) ?? null,
          };
      }),
    } satisfies RespondentAnswerCell;
  });

  const contributorMap = new Map<string, number>();
  for (const response of responses) {
    if (!response.created_by) continue;
    contributorMap.set(
      response.created_by,
      (contributorMap.get(response.created_by) ?? 0) + 1,
    );
  }
  const contributors: RespondentContributor[] = Array.from(contributorMap.entries())
    .map(([userId, contributions]) => ({
      userId,
      fullName: userNames.get(userId) ?? null,
      contributions,
    }))
    .sort((left, right) => right.contributions - left.contributions);

  const answeredQuestions = responses.length;
  const totalQuestions = orderedQuestions.length;
  const lastUpdatedAt = responses.reduce<string | null>((current, response) => {
    if (!current) return response.updated_at;
    return Date.parse(response.updated_at) > Date.parse(current)
      ? response.updated_at
      : current;
  }, null);
  const firstAnsweredAt = responses.reduce<string | null>((current, response) => {
    if (!current) return response.created_at;
    return Date.parse(response.created_at) < Date.parse(current)
      ? response.created_at
      : current;
  }, null);

  const status = deriveValidationStatus({
    answered: answeredQuestions,
    total: totalQuestions,
    cycleState: cycleState,
    hasComplementationRequested,
  });

  const waivedQuestions = waiverByQuestion.size;
  const notApplicableResponses = responses.filter(
    (response) => response.is_not_applicable === true,
  ).length;
  const applicableQuestions = Math.max(
    0,
    totalQuestions - waivedQuestions - notApplicableResponses,
  );

  return {
    cycleId: cycle.id,
    cycleState: cycleState,
    periodLabel: cycle.period_label,
    organizationId,
    organizationName: organization.name,
    status,
    answeredQuestions,
    totalQuestions,
    waivedQuestions,
    applicableQuestions,
    lastUpdatedAt,
    firstAnsweredAt,
    contributors,
    answers,
  };
}
