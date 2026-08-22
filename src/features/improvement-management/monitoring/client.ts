import { apiErrorSchema, buildHeaders, formatError, parseJson } from "@/infrastructure/api/fetch-client";
import {
  adminActionPlanMonitoringSchema,
  adminRecommendationMonitoringSchema,
} from "@/features/improvement-management/client-contracts";
import type { ZodType } from "zod";
import type {
  AdminActionPlanMonitoringQuery,
  AdminActionPlanMonitoringResult,
  AdminRecommendationMonitoringQuery,
  AdminRecommendationMonitoringResult,
} from "./types";

function appendCommonQuery(
  params: URLSearchParams,
  query: {
    organizationId?: string;
    formId?: string;
    cycleId?: string;
    search?: string;
    from?: string;
    to?: string;
    layout?: "list" | "organization";
    page?: number;
    pageSize?: number;
  },
) {
  if (query.organizationId) params.set("organizationId", query.organizationId);
  if (query.formId) params.set("formId", query.formId);
  if (query.cycleId) params.set("cycleId", query.cycleId);
  if (query.search) params.set("search", query.search);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.layout) params.set("layout", query.layout);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
}

function actionPlanParams(
  query: AdminActionPlanMonitoringQuery,
  options: { export?: boolean; format?: "csv" | "xlsx" | "pdf" } = {},
): URLSearchParams {
  const params = new URLSearchParams();
  appendCommonQuery(params, query);
  if (query.view) params.set("view", query.view);
  if (query.cardFilter) params.set("cardFilter", query.cardFilter);
  if (options.export) {
    params.set("export", "true");
    params.set("format", options.format ?? "csv");
  }
  return params;
}

function recommendationParams(
  query: AdminRecommendationMonitoringQuery,
  options: { export?: boolean; format?: "csv" | "xlsx" | "pdf" } = {},
): URLSearchParams {
  const params = new URLSearchParams();
  appendCommonQuery(params, query);
  if (query.axisId) params.set("axisId", query.axisId);
  if (query.status) params.set("status", query.status);
  if (query.cardFilter) params.set("cardFilter", query.cardFilter);
  if (options.export) {
    params.set("export", "true");
    params.set("format", options.format ?? "csv");
  }
  return params;
}

async function getJson<TResult>(url: string, schema: ZodType<TResult>, signal?: AbortSignal): Promise<TResult> {
  const response = await fetch(url, {
    headers: buildHeaders(),
    signal,
    cache: "no-store",
  });
  const body = await parseJson(response, schema);
  if (!response.ok) throw new Error(formatError(body));
  return body;
}

export function listAdminActionPlanMonitoring(
  query: AdminActionPlanMonitoringQuery,
  signal?: AbortSignal,
): Promise<AdminActionPlanMonitoringResult> {
  const params = actionPlanParams(query);
  return getJson(`/api/admin/action-plans/monitoring?${params.toString()}`, adminActionPlanMonitoringSchema, signal);
}

export function listAdminRecommendationMonitoring(
  query: AdminRecommendationMonitoringQuery,
  signal?: AbortSignal,
): Promise<AdminRecommendationMonitoringResult> {
  const params = recommendationParams(query);
  return getJson(`/api/admin/recommendations/monitoring?${params.toString()}`, adminRecommendationMonitoringSchema, signal);
}

function filenameFromResponse(response: Response, fallback: string): string {
  const header = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/i.exec(header);
  return match?.[1] ?? fallback;
}

async function downloadExportFile(url: string, fallbackFilename: string): Promise<void> {
  const response = await fetch(url, {
    headers: buildHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await parseJson(response, apiErrorSchema);
    throw new Error(formatError(body));
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filenameFromResponse(response, fallbackFilename);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function exportAdminActionPlansCsv(query: AdminActionPlanMonitoringQuery): Promise<void> {
  return exportAdminActionPlans(query, "csv");
}

export function exportAdminActionPlans(
  query: AdminActionPlanMonitoringQuery,
  format: "csv" | "xlsx" | "pdf" = "csv",
): Promise<void> {
  const params = actionPlanParams(query, { export: true, format });
  const fallback =
    format === "xlsx"
      ? "plano-de-acao.xlsx"
      : format === "pdf"
        ? "plano-de-acao.pdf"
        : "acoes-monitoradas.csv";
  return downloadExportFile(
    `/api/admin/action-plans/monitoring?${params.toString()}`,
    fallback,
  );
}

export function exportAdminRecommendationsCsv(
  query: AdminRecommendationMonitoringQuery,
): Promise<void> {
  return exportAdminRecommendations(query, "csv");
}

export function exportAdminRecommendations(
  query: AdminRecommendationMonitoringQuery,
  format: "csv" | "xlsx" | "pdf" = "csv",
): Promise<void> {
  const params = recommendationParams(query, { export: true, format });
  const fallback =
    format === "xlsx"
      ? "portfolio-recomendacoes.xlsx"
      : format === "pdf"
        ? "portfolio-recomendacoes.pdf"
        : "portfolio-recomendacoes.csv";
  return downloadExportFile(
    `/api/admin/recommendations/monitoring?${params.toString()}`,
    fallback,
  );
}
