import { apiErrorSchema, buildHeaders, formatError, parseJson } from "@/infrastructure/api/fetch-client";
import { evidenceFilterOptionsSchema, evidenceStatsSchema, evidencesListSchema } from "./client-contracts";
import type {
  EvidenceFilterOptions,
  EvidenceStatsResult,
  EvidencesListResult,
} from "./types";
import type { EvidenceExportFormat, ValidationStatus } from "./schemas";

export type ListEvidencesFilters = {
  cycleId?: string;
  questionId?: string;
  formId?: string;
  organizationId?: string;
  status?: ValidationStatus;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  ids?: string[];
};

function appendEvidenceFilterParams(
  params: URLSearchParams,
  filters: ListEvidencesFilters,
) {
  if (filters.cycleId) params.set("cycleId", filters.cycleId);
  if (filters.questionId) params.set("questionId", filters.questionId);
  if (filters.formId) params.set("formId", filters.formId);
  if (filters.organizationId) params.set("organizationId", filters.organizationId);
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (typeof filters.limit === "number") params.set("limit", String(filters.limit));
  if (typeof filters.offset === "number") params.set("offset", String(filters.offset));
  if (filters.ids?.length) params.set("ids", filters.ids.join(","));
}

export async function listEvidences(
  filters: ListEvidencesFilters = {},
): Promise<EvidencesListResult> {
  const params = new URLSearchParams();
  appendEvidenceFilterParams(params, filters);
  const qs = params.toString();
  const res = await fetch(`/api/admin/evidences${qs ? `?${qs}` : ""}`, {
    headers: buildHeaders(),
  });
  const body = await parseJson(res, evidencesListSchema);
  if (!res.ok || !Array.isArray(body.items)) {
    throw new Error(formatError(body));
  }
  return body;
}

export type EvidenceStatsFilters = Pick<
  ListEvidencesFilters,
  "cycleId" | "questionId" | "formId" | "organizationId" | "search" | "from" | "to" | "ids"
>;

export async function getEvidenceStats(
  filters: EvidenceStatsFilters = {},
): Promise<EvidenceStatsResult> {
  const params = new URLSearchParams();
  if (filters.cycleId) params.set("cycleId", filters.cycleId);
  if (filters.questionId) params.set("questionId", filters.questionId);
  if (filters.formId) params.set("formId", filters.formId);
  if (filters.organizationId) params.set("organizationId", filters.organizationId);
  if (filters.search) params.set("search", filters.search);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.ids?.length) params.set("ids", filters.ids.join(","));
  const qs = params.toString();
  const res = await fetch(`/api/admin/evidences/stats${qs ? `?${qs}` : ""}`, {
    headers: buildHeaders(),
  });
  const body = await parseJson(res, evidenceStatsSchema);
  if (!res.ok || typeof body.total !== "number") {
    throw new Error(formatError(body));
  }
  return body;
}

export async function downloadEvidencesExport(
  format: EvidenceExportFormat,
  filters: ListEvidencesFilters,
  selectedIds?: string[],
): Promise<void> {
  const params = new URLSearchParams();
  params.set("format", format);
  appendEvidenceFilterParams(params, filters);
  if (selectedIds && selectedIds.length > 0) {
    params.set("ids", selectedIds.join(","));
  }
  const res = await fetch(`/api/admin/evidences/export?${params.toString()}`, {
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
  let filename = `evidencias.${format}`;
  const m = /filename="([^"]+)"/.exec(dispo ?? "");
  if (m?.[1]) filename = m[1];
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function loadEvidenceFilters(): Promise<EvidenceFilterOptions> {
  const res = await fetch("/api/admin/evidences/filters", {
    headers: buildHeaders(),
  });
  const body = await parseJson(res, evidenceFilterOptionsSchema);
  if (!res.ok || !Array.isArray(body.forms)) throw new Error(formatError(body));
  return body;
}
