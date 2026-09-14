import { z } from "zod";
import { apiErrorSchema, apiResponseSchema, buildHeaders, parseJson, formatError } from "@/infrastructure/api/fetch-client";
import { notify } from "@/infrastructure/notifications/notify";
import { reportLifecycleStatusSchema, type ReportLifecycleStatus } from "@/shared/domain/report-lifecycle";
import type { ReportCatalogKind } from "@/features/reports/report-catalog";

const reportOrganizationOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const reportCycleOptionSchema = z.object({
  cycleId: z.string(),
  formId: z.string(),
  formName: z.string(),
  formVersion: z.number(),
  periodLabel: z.string(),
  referenceStartYear: z.number().int().nullable(),
  referenceEndYear: z.number().int().nullable(),
  latestProcessingVersion: z.number().int(),
  policyVersion: z.string(),
  cycleState: z.string(),
  isHistoricalProcessing: z.boolean(),
  emissionCount: z.number().int(),
  latestEmissionVersion: z.number().int().nullable(),
  reportStatus: reportLifecycleStatusSchema,
});

export const reportHistoryOptionSchema = z.object({
  id: z.string(),
  cycleId: z.string(),
  cycleProcessingId: z.string(),
  organizationId: z.string(),
  processingVersion: z.number().int(),
  policyVersion: z.string(),
  latestProcessingVersion: z.number().int(),
  emissionVersion: z.number().int(),
  latestEmissionVersion: z.number().int(),
  isCurrent: z.boolean(),
  formId: z.string(),
  formName: z.string(),
  formVersion: z.number(),
  periodLabel: z.string(),
  generatedAt: z.string(),
  generatedBy: z.string().nullable(),
  generatedByLabel: z.string(),
  reissueReason: z.string().nullable(),
  referenceStartYear: z.number().int().nullable(),
  referenceEndYear: z.number().int().nullable(),
  fileSha256: z.string().nullable(),
  contentSha256: z.string().nullable(),
  fileSizeBytes: z.number().nullable(),
  outdatedReason: z.string().nullable(),
  downloadPath: z.string(),
  catalogKind: z.enum(["annual", "bimonthly"]),
  bimester: z.number().int().min(1).max(6).nullable().optional(),
  generationKind: z.enum(["manual", "automatic"]).nullable().optional(),
});

const reportOptionsSchema = apiResponseSchema({
  organizations: z.array(reportOrganizationOptionSchema),
  cycles: z.array(reportCycleOptionSchema),
  totalCycles: z.number(),
  limit: z.number(),
  offset: z.number(),
  hasMoreCycles: z.boolean(),
});

export const reportHistoryPageSchema = apiResponseSchema({
  items: z.array(reportHistoryOptionSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean(),
  availableYears: z.array(z.number().int()),
  viewerUserId: z.string().nullable().optional(),
});

async function parseErrorResponse(response: Response) {
  try {
    return await parseJson(response, apiErrorSchema);
  } catch {
    return undefined;
  }
}

type ReportOrganizationOption = { id: string; name: string };
export type ReportCycleOption = {
  cycleId: string;
  formId: string;
  formName: string;
  formVersion: number;
  periodLabel: string;
  referenceStartYear: number | null;
  referenceEndYear: number | null;
  latestProcessingVersion: number;
  policyVersion: string;
  cycleState: string;
  isHistoricalProcessing: boolean;
  emissionCount: number;
  latestEmissionVersion: number | null;
  reportStatus: ReportLifecycleStatus;
};

/** Uma emissão imutável do relatório oficial. */
export type ReportHistoryOption = {
  id: string;
  cycleId: string;
  cycleProcessingId: string;
  organizationId: string;
  processingVersion: number;
  policyVersion: string;
  latestProcessingVersion: number;
  emissionVersion: number;
  latestEmissionVersion: number;
  isCurrent: boolean;
  formId: string;
  formName: string;
  formVersion: number;
  periodLabel: string;
  generatedAt: string;
  generatedBy: string | null;
  generatedByLabel: string;
  reissueReason: string | null;
  referenceStartYear: number | null;
  referenceEndYear: number | null;
  fileSha256: string | null;
  contentSha256: string | null;
  fileSizeBytes: number | null;
  outdatedReason: string | null;
  downloadPath: string;
  catalogKind: ReportCatalogKind;
  bimester?: number | null;
  generationKind?: "manual" | "automatic" | null;
};

export type ReportHistoryPage = {
  items: ReportHistoryOption[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  availableYears: number[];
};

export type LoadReportHistoryInput = {
  organizationId?: string;
  cycleId?: string;
  search?: string;
  status?: "current" | "historical";
  from?: string;
  to?: string;
  referenceYear?: number;
  kind?: ReportCatalogKind;
  limit?: number;
  offset?: number;
};

export type ReportOptionsResult = {
  organizations: ReportOrganizationOption[];
  cycles: ReportCycleOption[];
  totalCycles: number;
  limit: number;
  offset: number;
  hasMoreCycles: boolean;
};

export type LoadReportOptionsInput = {
  organizationId?: string;
  cycleId?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export async function loadReportOptions(
  input: LoadReportOptionsInput = {},
): Promise<ReportOptionsResult> {
  const params = new URLSearchParams();
  if (input.organizationId) params.set("organizationId", input.organizationId);
  if (input.cycleId) params.set("cycleId", input.cycleId);
  if (input.search?.trim()) params.set("search", input.search.trim());
  if (input.limit != null) params.set("limit", String(input.limit));
  if (input.offset != null) params.set("offset", String(input.offset));
  const qs = params.size ? `?${params}` : "";
  const response = await fetch(`/api/reports/options${qs}`, {
    credentials: "include",
    headers: buildHeaders(),
  });
  const payload = await parseJson(response, reportOptionsSchema);
  if (!response.ok) throw new Error(formatError(payload, "Falha ao carregar escopo."));
  return {
    organizations: payload.organizations ?? [],
    cycles: payload.cycles ?? [],
    totalCycles: Number(payload.totalCycles ?? 0),
    limit: Number(payload.limit ?? input.limit ?? 25),
    offset: Number(payload.offset ?? input.offset ?? 0),
    hasMoreCycles: Boolean(payload.hasMoreCycles),
  };
}

/** Histórico paginado. O servidor aplica filtros e devolve a contagem real. */
export async function loadReportHistory(
  input: LoadReportHistoryInput = {},
): Promise<ReportHistoryPage> {
  const params = new URLSearchParams();
  if (input.organizationId) params.set("organizationId", input.organizationId);
  if (input.cycleId) params.set("cycleId", input.cycleId);
  if (input.search?.trim()) params.set("search", input.search.trim());
  if (input.status) params.set("status", input.status);
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.referenceYear != null) params.set("referenceYear", String(input.referenceYear));
  if (input.kind) params.set("kind", input.kind);
  if (input.limit != null) params.set("limit", String(input.limit));
  if (input.offset != null) params.set("offset", String(input.offset));
  const query = params.toString();
  const response = await fetch(`/api/reports/history${query ? `?${query}` : ""}`, {
    credentials: "include",
    headers: buildHeaders(),
  });
  const payload = await parseJson(response, reportHistoryPageSchema);
  if (!response.ok) throw new Error(formatError(payload, "Falha ao carregar histórico."));
  return {
    items: payload.items ?? [],
    total: Number(payload.total ?? 0),
    limit: Number(payload.limit ?? input.limit ?? 25),
    offset: Number(payload.offset ?? input.offset ?? 0),
    hasMore: Boolean(payload.hasMore),
    availableYears: payload.availableYears ?? [],
  };
}

/** Emissão administrativa do PDF oficial. Respondentes não chamam esta operação. */
async function generateOfficialReportPdf(payload: {
  cycleId: string;
  processingVersion?: number;
  reissueReason?: string;
}): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch("/api/reports/official", {
    method: "POST",
    credentials: "include",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await parseErrorResponse(response);
    throw new Error(formatError(body, "Falha ao emitir PDF."));
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? "relatorio-orienta.pdf";
  return { blob: await response.blob(), filename };
}

const persistedReportDownloadSchema = apiResponseSchema({
  url: z.string().url(),
  filename: z.string().min(1),
});

/** Busca um PDF já persistido por uma rota autenticada, sem emitir nova versão. */
export async function fetchPersistedReportPdf(downloadPath: string): Promise<Blob> {
  // A navegação direta ainda recebe 307. O fetch do browser não lê Location
  // desse redirect (opaqueredirect), então o cliente pede a URL assinada em JSON.
  const signed = await fetch(downloadPath, {
    credentials: "include",
    headers: buildHeaders({ Accept: "application/json" }),
  });
  if (!signed.ok) {
    const body = await parseErrorResponse(signed);
    throw new Error(formatError(body, "Não foi possível obter o PDF oficial."));
  }
  const payload = await parseJson(signed, persistedReportDownloadSchema);
  const fileResponse = await fetch(payload.url);
  if (!fileResponse.ok) {
    throw new Error("Não foi possível obter o PDF oficial.");
  }
  return fileResponse.blob();
}

/** Baixa o PDF do catálogo: anual persistido ou bimestral gerado sob demanda. */
export async function fetchCatalogReportPdf(downloadPath: string): Promise<Blob> {
  if (downloadPath.includes("/api/monitoring/bimonthly/")) {
    const response = await fetch(downloadPath, {
      credentials: "include",
      headers: buildHeaders(),
    });
    if (!response.ok) {
      const body = await parseErrorResponse(response);
      throw new Error(formatError(body, "Não foi possível obter o relatório bimestral."));
    }
    const contentType = response.headers.get("Content-Type") ?? "";
    if (!contentType.includes("application/pdf")) {
      throw new Error("Não foi possível obter o relatório bimestral.");
    }
    return response.blob();
  }
  return fetchPersistedReportPdf(downloadPath);
}

export function downloadPdfBlob(blob: Blob, filename = "relatorio-orienta.pdf"): void {
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // O navegador precisa da blob URL até iniciar o download; revogar no próximo tick abortava o evento.
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
}

export async function generateAndDownloadOfficialReport(payload: {
  cycleId: string;
  processingVersion?: number;
  reissueReason?: string;
}): Promise<void> {
  const loadingId = notify.loading("Emitindo PDF oficial…");
  try {
    const generated = await generateOfficialReportPdf(payload);
    downloadPdfBlob(generated.blob, generated.filename);
    notify.success("PDF oficial emitido e download iniciado.", { id: loadingId });
  } catch (error) {
    notify.error(error instanceof Error ? error.message : "Erro de rede ao emitir o relatório.", { id: loadingId });
    throw error;
  }
}
