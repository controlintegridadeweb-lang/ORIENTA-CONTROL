import type {
  AnswersExportFormat,
  AnswersListFilters,
  AnswersOverview,
  AnswersSummary,
  RespondentDetail,
  RespondentFilterOptions,
  RespondentListCursor,
  RespondentListPage,
} from "./answers-types";
import { apiErrorSchema, buildHeaders, formatError, parseJson } from "@/infrastructure/api/fetch-client";
import {
  answersOverviewResponseSchema,
  answersSummaryResponseSchema,
  respondentDetailResponseSchema,
  respondentFiltersResponseSchema,
  respondentListResponseSchema,
} from "./client-contracts";

function appendFilterParams(params: URLSearchParams, filters?: AnswersListFilters | null): void {
  if (!filters) return;
  if (filters.organizationId) params.set("organizationId", filters.organizationId);
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
}

export async function getAnswersOverview(formId: string): Promise<AnswersOverview> {
  const res = await fetch(`/api/admin/forms/${formId}/answers/overview`, {
    headers: buildHeaders(),
    cache: "no-store",
  });
  const body = await parseJson(res, answersOverviewResponseSchema);
  if (!res.ok || !body.overview) throw new Error(formatError(body));
  return body.overview;
}

export async function getAnswersSummary(formId: string): Promise<AnswersSummary> {
  const res = await fetch(`/api/admin/forms/${formId}/answers/summary`, {
    headers: buildHeaders(),
    cache: "no-store",
  });
  const body = await parseJson(res, answersSummaryResponseSchema);
  if (!res.ok || !body.summary) throw new Error(formatError(body));
  return body.summary;
}

export async function listAnswerRespondents(
  formId: string,
  options: {
    filters?: AnswersListFilters;
    cursor?: RespondentListCursor | null;
    limit?: number;
  } = {},
): Promise<RespondentListPage> {
  const params = new URLSearchParams();
  appendFilterParams(params, options.filters);
  if (options.cursor) {
    params.set("cursorUpdatedAt", options.cursor.updatedAt);
    params.set("cursorCycleId", options.cursor.cycleId);
  }
  if (options.limit) params.set("limit", String(options.limit));
  const qs = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`/api/admin/forms/${formId}/answers/respondents${qs}`, {
    headers: buildHeaders(),
    cache: "no-store",
  });
  const body = await parseJson(res, respondentListResponseSchema);
  if (!res.ok || !body.page) throw new Error(formatError(body));
  return body.page;
}

export async function getRespondentDetail(
  cycleId: string,
): Promise<RespondentDetail> {
  const res = await fetch(
    `/api/admin/cycles/${cycleId}/answers`,
    { headers: buildHeaders(), cache: "no-store" },
  );
  const body = await parseJson(res, respondentDetailResponseSchema);
  if (!res.ok || !body.detail) throw new Error(formatError(body));
  return body.detail;
}

export async function getAnswersFilterOptions(
  formId: string,
): Promise<RespondentFilterOptions> {
  const res = await fetch(
    `/api/admin/forms/${formId}/answers/respondents/filters`,
    { headers: buildHeaders(), cache: "no-store" },
  );
  const body = await parseJson(res, respondentFiltersResponseSchema);
  if (!res.ok || !body.options) throw new Error(formatError(body));
  return body.options;
}

/**
 * Aciona o download de uma exportacao (PDF/CSV/XLSX). Faz a requisicao via
 * `fetch` para enviar os headers de dev-auth, depois cria um `Blob` URL e
 * dispara o download. Compatible com Safari/Firefox/Chrome.
 */
export async function downloadAnswersExport(
  formId: string,
  format: AnswersExportFormat,
  options: { filters?: AnswersListFilters; suggestedName?: string } = {},
): Promise<void> {
  const params = new URLSearchParams({ format });
  appendFilterParams(params, options.filters);
  const res = await fetch(
    `/api/admin/forms/${formId}/answers/export?${params.toString()}`,
    { headers: buildHeaders() },
  );
  if (!res.ok) {
    const body = await parseJson(res, apiErrorSchema);
    throw new Error(formatError(body));
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = options.suggestedName ?? `respostas-${formId}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
