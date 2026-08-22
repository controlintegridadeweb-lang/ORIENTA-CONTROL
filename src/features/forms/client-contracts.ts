import { z } from "zod";
import { apiResponseSchema } from "@/infrastructure/api/fetch-client";
import { objectContract } from "@/infrastructure/api/contract-schema";
import type { FormSummary, QuestionRow } from "./admin-service";
import type {
  AnswersOverview,
  AnswersSummary,
  RespondentDetail,
  RespondentFilterOptions,
  RespondentListPage,
} from "./answers-types";
import type { FormPublishPending } from "./publish-contract";

export const formSummaryContract = objectContract<FormSummary>("resumo do formulário", {
  id: "string", name: "string", version: "nullable-number", state: "string", createdAt: "string", questionCount: "number", publishedAt: "nullable-string",
});
export const questionRowContract = objectContract<QuestionRow>("critério do formulário", {
  id: "string", prompt: "string", sectionId: "string", requiresEvidence: "boolean", allowsNotApplicable: "boolean", orderIndex: "number",
});
export const formPublishPendingContract = objectContract<FormPublishPending>("pendência de publicação", {
  questionId: "string", missing: "array",
});
type AssignmentOrganization = { id: string; name: string; assigned: boolean; locked: boolean };
type AssignmentsSummary = { formId: string; organizationIds: string[] };

export const assignmentOrganizationContract = objectContract<AssignmentOrganization>("organização atribuível", {
  id: "string", name: "string", assigned: "boolean", locked: "boolean",
});
export const assignmentsSummaryContract = objectContract<AssignmentsSummary>("resumo de atribuições", {
  formId: "string", organizationIds: "array",
});

export const formsPageSchema = apiResponseSchema({
  items: z.array(formSummaryContract),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});
export const formResponseSchema = apiResponseSchema({ form: formSummaryContract.optional() });
export const okResponseSchema = apiResponseSchema({ ok: z.boolean().optional() });
export const publishReadinessSchema = apiResponseSchema({
  readiness: z.object({
    canPublish: z.boolean(),
    pending: z.array(formPublishPendingContract),
    checks: z.object({
      hasName: z.boolean(), hasQuestions: z.boolean(), bindingsComplete: z.boolean(), hasAssignments: z.boolean(),
    }),
    questionCount: z.number().int().nonnegative(),
    assignmentCount: z.number().int().nonnegative(),
  }),
  form: z.object({
    id: z.string(),
    name: z.string(),
    state: z.enum(["draft", "published", "superseded", "archived"]),
    version: z.number().int().nullable(),
  }),
  questionCount: z.number().int().nonnegative(),
});
export const publishResponseSchema = apiResponseSchema({
  form: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    version: z.number().int().nullable().optional(),
    state: z.string().optional(),
    createdAt: z.string().optional(),
    questionCount: z.number().int().nonnegative().optional(),
    publishedAt: z.string().nullable().optional(),
  }).optional(),
  pending: z.array(formPublishPendingContract).optional(),
});
export const questionsResponseSchema = apiResponseSchema({ questions: z.array(questionRowContract).optional() });
export const questionResponseSchema = apiResponseSchema({ question: questionRowContract.optional() });
export const assignmentsResponseSchema = apiResponseSchema({
  summary: assignmentsSummaryContract.optional(),
  organizations: z.array(assignmentOrganizationContract).optional(),
});
export const assignmentsSummaryResponseSchema = apiResponseSchema({ summary: assignmentsSummaryContract.optional() });

const answersOverviewContract = objectContract<AnswersOverview>("visão geral de respostas", {
  formId: "string", formName: "string", totalRespondents: "number", totalCycles: "number", totalQuestions: "number", lastAnswerAt: "nullable-string", statusBreakdown: "object",
});
const answersSummaryContract = objectContract<AnswersSummary>("resumo de respostas", {
  formId: "string", totalRespondents: "number", questions: "array",
});
const respondentListPageContract = objectContract<RespondentListPage>("página de respondentes", {
  rows: "array", nextCursor: "nullable-object",
});
const respondentDetailContract = objectContract<RespondentDetail>("detalhe do respondente", {
  cycleId: "string", cycleState: "string", periodLabel: "string", organizationId: "string", organizationName: "string", status: "string", answeredQuestions: "number", totalQuestions: "number", contributors: "array", answers: "array",
});
const respondentFilterOptionsContract = objectContract<RespondentFilterOptions>("filtros de respondentes", {
  organizations: "array",
});
export const answersOverviewResponseSchema = apiResponseSchema({ overview: answersOverviewContract.optional() });
export const answersSummaryResponseSchema = apiResponseSchema({ summary: answersSummaryContract.optional() });
export const respondentListResponseSchema = apiResponseSchema({ page: respondentListPageContract.optional() });
export const respondentDetailResponseSchema = apiResponseSchema({ detail: respondentDetailContract.optional() });
export const respondentFiltersResponseSchema = apiResponseSchema({ options: respondentFilterOptionsContract.optional() });
