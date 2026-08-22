import { buildHeaders, formatError, parseJson } from "@/infrastructure/api/fetch-client";
import {
  assignmentsResponseSchema,
  assignmentsSummaryResponseSchema,
  formResponseSchema,
  formsPageSchema,
  okResponseSchema,
  publishReadinessSchema,
  publishResponseSchema,
  questionResponseSchema,
  questionsResponseSchema,
} from "./client-contracts";
import type { FormSummary, QuestionRow } from "./admin-service";
import { FormPublishPendingError } from "./publish-contract";

export { FormPublishPendingError };

// -- Formularios ----------------------------------------------------------

export type FormsPageResult = {
  items: FormSummary[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
};

export async function listForms(options: {
  state?: string;
  search?: string;
  page?: number;
  limit?: number;
} = {}): Promise<FormsPageResult> {
  const params = new URLSearchParams();
  if (options.state) params.set("state", options.state);
  if (options.search) params.set("search", options.search);
  params.set("page", String(options.page ?? 1));
  params.set("limit", String(options.limit ?? 25));
  const res = await fetch(`/api/admin/forms?${params.toString()}`, { headers: buildHeaders() });
  const body = await parseJson(res, formsPageSchema);
  if (!res.ok || !Array.isArray(body.items)) throw new Error(formatError(body));
  return body;
}

export async function createForm(payload: { name: string }): Promise<FormSummary> {
  const res = await fetch("/api/admin/forms", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await parseJson(res, formResponseSchema);
  if (!res.ok || !body.form) throw new Error(formatError(body));
  return body.form;
}

export async function renameForm(formId: string, name: string): Promise<FormSummary> {
  const res = await fetch(`/api/admin/forms/${formId}`, {
    method: "PATCH",
    headers: buildHeaders(),
    body: JSON.stringify({ name }),
  });
  const body = await parseJson(res, formResponseSchema);
  if (!res.ok || !body.form) throw new Error(formatError(body));
  return body.form;
}

export async function deleteForm(formId: string): Promise<void> {
  const res = await fetch(`/api/admin/forms/${formId}`, {
    method: "DELETE",
    headers: buildHeaders(),
  });
  const body = await parseJson(res, okResponseSchema);
  if (!res.ok) throw new Error(formatError(body));
}

export type FormPublishReadinessPayload = {
  readiness: import("./publish-readiness").FormPublishReadiness;
  form: {
    id: string;
    name: string;
    state: import("./form-publication-state").FormPublicationState;
    version: number | null;
  };
  questionCount: number;
};

export async function fetchFormPublishReadiness(
  formId: string,
): Promise<FormPublishReadinessPayload> {
  const res = await fetch(`/api/admin/forms/${formId}/readiness`, {
    headers: buildHeaders(),
  });
  const body = await parseJson(res, publishReadinessSchema);
  if (!res.ok || !body.readiness) throw new Error(formatError(body));
  return body;
}

export async function publishForm(formId: string): Promise<FormSummary> {
  const res = await fetch(`/api/admin/forms/${formId}/publish`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ action: "publish" }),
  });
  const body = await parseJson(res, publishResponseSchema);
  if (res.status === 409 && Array.isArray(body.pending) && body.pending.length > 0) {
    throw new FormPublishPendingError(body.error ?? "Binding incompleto.", body.pending);
  }
  if (!res.ok || !body.form) throw new Error(formatError(body));
  return {
    id: String(body.form.id),
    name: String(body.form.name),
    version: body.form.version ?? null,
    state:
      body.form.state === "published" || body.form.state === "superseded" || body.form.state === "archived"
        ? body.form.state
        : "draft",
    createdAt: String(body.form.createdAt),
    questionCount: Number(body.form.questionCount ?? 0),
    publishedAt: body.form.publishedAt ?? null,
  };
}

// -- Perguntas ------------------------------------------------------------

export async function listFormQuestions(formId: string): Promise<QuestionRow[]> {
  const res = await fetch(`/api/admin/forms/${formId}/questions`, {
    headers: buildHeaders(),
  });
  const body = await parseJson(res, questionsResponseSchema);
  if (!res.ok || !body.questions) throw new Error(formatError(body));
  return body.questions;
}

export async function createFormQuestion(
  formId: string,
  payload: {
    prompt: string;
    sectionId: string;
    requiresEvidence: boolean;
    allowsNotApplicable?: boolean;
  },
): Promise<QuestionRow> {
  const res = await fetch(`/api/admin/forms/${formId}/questions`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await parseJson(res, questionResponseSchema);
  if (!res.ok || !body.question) throw new Error(formatError(body));
  return body.question;
}

export async function updateFormQuestion(
  formId: string,
  questionId: string,
  payload: {
    prompt?: string;
    requiresEvidence?: boolean;
    allowsNotApplicable?: boolean;
  },
): Promise<QuestionRow> {
  const res = await fetch(`/api/admin/forms/${formId}/questions/${questionId}`, {
    method: "PATCH",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await parseJson(res, questionResponseSchema);
  if (!res.ok || !body.question) throw new Error(formatError(body));
  return body.question;
}

export async function removeFormQuestion(formId: string, questionId: string): Promise<void> {
  const res = await fetch(`/api/admin/forms/${formId}/questions/${questionId}`, {
    method: "DELETE",
    headers: buildHeaders(),
  });
  const body = await parseJson(res, okResponseSchema);
  if (!res.ok) throw new Error(formatError(body));
}

export async function reorderFormQuestions(
  formId: string,
  orderedQuestionIds: string[],
): Promise<QuestionRow[]> {
  const res = await fetch(`/api/admin/forms/${formId}/questions/reorder`, {
    method: "PATCH",
    headers: buildHeaders(),
    body: JSON.stringify({ orderedQuestionIds }),
  });
  const body = await parseJson(res, questionsResponseSchema);
  if (!res.ok || !body.questions) throw new Error(formatError(body));
  return body.questions;
}

// -- Atribuições (form_assignments) ------------------------------------

export type FormAssignmentOrganizationOption = {
  id: string;
  name: string;
  assigned: boolean;
  locked: boolean;
};

export type FormAssignmentsPayload = {
  summary: {
    formId: string;
    organizationIds: string[];
  };
  organizations: FormAssignmentOrganizationOption[];
};

export async function getFormAssignments(formId: string): Promise<FormAssignmentsPayload> {
  const res = await fetch(`/api/admin/forms/${formId}/assignments`, { headers: buildHeaders() });
  const body = await parseJson(res, assignmentsResponseSchema);
  if (!res.ok || !body.summary || !body.organizations) throw new Error(formatError(body));
  return { summary: body.summary, organizations: body.organizations };
}

export async function syncFormAssignments(
  formId: string,
  organizationIds: string[],
): Promise<FormAssignmentsPayload["summary"]> {
  const res = await fetch(`/api/admin/forms/${formId}/assignments`, {
    method: "PUT",
    headers: buildHeaders(),
    body: JSON.stringify({ organizationIds }),
  });
  const body = await parseJson(res, assignmentsSummaryResponseSchema);
  if (!res.ok || !body.summary) throw new Error(formatError(body));
  return body.summary;
}
