import { apiResponseSchema, buildHeaders, formatError, parseJson } from "@/infrastructure/api/fetch-client";
import { objectContract } from "@/infrastructure/api/contract-schema";
import type { DeadlineScope } from "./domain";
import type { FormManagementDetails, FormManagementMutationResult } from "./types";


const formManagementDetailsContract = objectContract<FormManagementDetails>(
  "detalhes de gestão do formulário",
  {
    formId: "string",
    formName: "string",
    formVersion: "number",
    formVersionId: "string",
    periodLabel: "string",
    status: "string",
    counts: "object",
    actions: "array",
    organizations: "array",
    criteria: "array",
    history: "array",
  },
);
const formManagementMutationContract = objectContract<FormManagementMutationResult>(
  "resultado de alteração da aplicação",
  { batchId: "string", updated: "number", action: "string" },
);
const detailsResponseSchema = apiResponseSchema({ details: formManagementDetailsContract.optional() });
const mutationResponseSchema = apiResponseSchema({ result: formManagementMutationContract.optional() });
function formApplicationPath(formId: string, suffix = "") {
  return `/api/admin/form-applications/${encodeURIComponent(formId)}${suffix}`;
}

export async function fetchFormManagementDetails(input: {
  formId: string;
  periodLabel?: string;
}): Promise<FormManagementDetails> {
  const params = new URLSearchParams();
  if (input.periodLabel) params.set("periodLabel", input.periodLabel);
  const query = params.toString();
  const res = await fetch(
    `${formApplicationPath(input.formId)}${query ? `?${query}` : ""}`,
    { headers: buildHeaders(), cache: "no-store" },
  );
  const body = await parseJson(res, detailsResponseSchema);
  if (!res.ok || !body.details) throw new Error(formatError(body));
  return body.details;
}

export async function changeFormApplicationDeadline(input: {
  formId: string;
  periodLabel: string;
  action: "change_deadline" | "extend_deadline" | "early_close";
  scope: DeadlineScope;
  organizationIds?: string[];
  newDeadlineAt?: string | null;
  justification: string;
}): Promise<FormManagementMutationResult> {
  const res = await fetch(formApplicationPath(input.formId, "/deadline"), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      periodLabel: input.periodLabel,
      action: input.action,
      scope: input.scope,
      organizationIds: input.organizationIds,
      newDeadlineAt: input.newDeadlineAt ?? null,
      justification: input.justification,
    }),
  });
  const body = await parseJson(res, mutationResponseSchema);
  if (!res.ok || !body.result) throw new Error(formatError(body));
  return body.result;
}

export async function setFormApplicationPause(input: {
  formId: string;
  periodLabel: string;
  pause: boolean;
  scope?: DeadlineScope;
  organizationIds?: string[];
  justification: string;
}): Promise<FormManagementMutationResult> {
  const res = await fetch(formApplicationPath(input.formId, "/collection-pause"), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      periodLabel: input.periodLabel,
      pause: input.pause,
      scope: input.scope ?? "all",
      organizationIds: input.organizationIds,
      justification: input.justification,
    }),
  });
  const body = await parseJson(res, mutationResponseSchema);
  if (!res.ok || !body.result) throw new Error(formatError(body));
  return body.result;
}

export async function reopenFormApplication(input: {
  formId: string;
  periodLabel: string;
  scope: DeadlineScope;
  organizationIds?: string[];
  newDeadlineAt: string;
  justification: string;
  reopenMode?: "full" | "partial";
  questionVersionIds?: string[];
}): Promise<FormManagementMutationResult> {
  const res = await fetch(formApplicationPath(input.formId, "/reopen"), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      periodLabel: input.periodLabel,
      scope: input.scope,
      organizationIds: input.organizationIds,
      newDeadlineAt: input.newDeadlineAt,
      justification: input.justification,
      reopenMode: input.reopenMode ?? "full",
      questionVersionIds: input.questionVersionIds,
    }),
  });
  const body = await parseJson(res, mutationResponseSchema);
  if (!res.ok || !body.result) throw new Error(formatError(body));
  return body.result;
}

export async function reopenFormApplicationValidation(input: {
  formId: string;
  periodLabel: string;
  scope: DeadlineScope;
  organizationIds?: string[];
  justification: string;
}): Promise<FormManagementMutationResult> {
  const res = await fetch(formApplicationPath(input.formId, "/reopen-validation"), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      periodLabel: input.periodLabel,
      scope: input.scope,
      organizationIds: input.organizationIds,
      justification: input.justification,
    }),
  });
  const body = await parseJson(res, mutationResponseSchema);
  if (!res.ok || !body.result) throw new Error(formatError(body));
  return body.result;
}
