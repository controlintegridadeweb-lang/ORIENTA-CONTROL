import type {
  RespondentEvidenceListResult,
  RespondentStatsResult,
} from "./respondent-service";
import type { ValidationStatus } from "./schemas";
import { apiErrorSchema, buildHeaders, formatError, parseJson } from "@/infrastructure/api/fetch-client";
import { respondentEvidenceListSchema, respondentEvidenceStatsSchema } from "./client-contracts";

export type RespondentEvidenceFilters = {
  cycleId?: string;
  formId?: string;
  search?: string;
  axisName?: string;
  sectionName?: string;
  status?: ValidationStatus;
  pendingOnly?: boolean;
  limit?: number;
  offset?: number;
};

function appendFilterParams(p: URLSearchParams, filters: RespondentEvidenceFilters) {
  if (filters.cycleId) p.set("cycleId", filters.cycleId);
  if (filters.formId) p.set("formId", filters.formId);
  if (filters.search) p.set("search", filters.search);
  if (filters.axisName) p.set("axisName", filters.axisName);
  if (filters.sectionName) p.set("sectionName", filters.sectionName);
  if (filters.status) p.set("status", filters.status);
  if (filters.pendingOnly) p.set("pendingOnly", "1");
  if (typeof filters.limit === "number") p.set("limit", String(filters.limit));
  if (typeof filters.offset === "number") p.set("offset", String(filters.offset));
}

export async function listRespondentEvidences(
  filters: RespondentEvidenceFilters = {},
): Promise<RespondentEvidenceListResult> {
  const params = new URLSearchParams();
  appendFilterParams(params, filters);
  const qs = params.toString();
  const res = await fetch(`/api/respondent/evidences${qs ? `?${qs}` : ""}`, {
    headers: buildHeaders(),
  });
  const body = await parseJson(res, respondentEvidenceListSchema);
  if (!res.ok || !Array.isArray(body.items)) {
    throw new Error(formatError(body));
  }
  return body;
}

export async function getRespondentEvidenceStats(
  filters: Pick<
    RespondentEvidenceFilters,
    "cycleId" | "formId" | "search" | "axisName" | "sectionName"
  > = {},
): Promise<RespondentStatsResult> {
  const params = new URLSearchParams();
  if (filters.cycleId) params.set("cycleId", filters.cycleId);
  if (filters.formId) params.set("formId", filters.formId);
  if (filters.search) params.set("search", filters.search);
  if (filters.axisName) params.set("axisName", filters.axisName);
  if (filters.sectionName) params.set("sectionName", filters.sectionName);
  const qs = params.toString();
  const res = await fetch(`/api/respondent/evidences/stats${qs ? `?${qs}` : ""}`, {
    headers: buildHeaders(),
  });
  const body = await parseJson(res, respondentEvidenceStatsSchema);
  if (!res.ok || typeof body.enviadas !== "number") {
    throw new Error(formatError(body));
  }
  return body;
}

export async function downloadRespondentEvidencesSpreadsheet(
  filters: Omit<RespondentEvidenceFilters, "limit" | "offset"> = {},
): Promise<void> {
  const params = new URLSearchParams();
  appendFilterParams(params, filters);
  const qs = params.toString();
  const res = await fetch(`/api/respondent/evidences/export${qs ? `?${qs}` : ""}`, {
    headers: buildHeaders({ Accept: "*/*" }),
  });
  if (!res.ok) {
    let message = res.statusText || "Falha na exportação.";
    try {
      message = formatError(await parseJson(res, apiErrorSchema), message);
    } catch {
      // O endpoint pode responder texto puro em falhas de proxy ou infraestrutura.
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const dispo = res.headers.get("Content-Disposition");
  let filename = "evidencias.xlsx";
  const match = /filename="([^"]+)"/.exec(dispo ?? "");
  if (match?.[1]) filename = match[1];
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
