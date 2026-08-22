import { buildHeaders, parseJson } from "@/infrastructure/api/fetch-client";
import { reportHistoryPageSchema, type LoadReportHistoryInput } from "./client";
import {
  defaultReportKindForOfficialPdf,
  type RespondentReportHistoryRow,
} from "./respondent-presentation";

/** Histórico do respondente pela mesma fonte canônica paginada da administração. */
export async function listRespondentReports(
  input: Omit<LoadReportHistoryInput, "organizationId"> = {},
): Promise<{
  items: RespondentReportHistoryRow[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  availableYears: number[];
}> {
  const params = new URLSearchParams();
  if (input.cycleId) params.set("cycleId", input.cycleId);
  if (input.search?.trim()) params.set("search", input.search.trim());
  if (input.status) params.set("status", input.status);
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.referenceYear != null) params.set("referenceYear", String(input.referenceYear));
  if (input.limit != null) params.set("limit", String(input.limit));
  if (input.offset != null) params.set("offset", String(input.offset));
  const response = await fetch(`/api/reports/history${params.size ? `?${params}` : ""}`, {
    credentials: "include",
    headers: buildHeaders(),
  });
  const body = await parseJson(response, reportHistoryPageSchema);
  if (!response.ok || !Array.isArray(body.items)) {
    throw new Error(typeof body.error === "string" ? body.error : "Falha ao carregar histórico.");
  }

  return {
    items: body.items.map((row) => ({
      id: row.id,
      cycleId: row.cycleId,
      formId: row.formId,
      formName: row.formName || "Formulário",
      periodLabel: row.periodLabel || "Período não informado",
      formTemplateVersion: row.formVersion ?? null,
      organizationId: row.organizationId,
      processingVersion: row.processingVersion,
      policyVersion: row.policyVersion,
      latestProcessingVersion: row.latestProcessingVersion,
      emissionVersion: row.emissionVersion,
      latestEmissionVersion: row.latestEmissionVersion,
      isCurrent: row.isCurrent,
      reissueReason: row.reissueReason,
      referenceStartYear: row.referenceStartYear,
      referenceEndYear: row.referenceEndYear,
      fileSha256: row.fileSha256,
      contentSha256: row.contentSha256,
      fileSizeBytes: row.fileSizeBytes,
      outdatedReason: row.outdatedReason,
      generatedBy: row.generatedBy ?? "",
      generatedByLabel: row.generatedByLabel || "Administração da plataforma",
      downloadPath: row.downloadPath,
      generatedAt: row.generatedAt,
      format: "pdf" as const,
      reportKind: defaultReportKindForOfficialPdf(),
      status: "completed" as const,
    })),
    total: Number(body.total ?? 0),
    limit: Number(body.limit ?? input.limit ?? 25),
    offset: Number(body.offset ?? input.offset ?? 0),
    hasMore: Boolean(body.hasMore),
    availableYears: body.availableYears ?? [],
  };
}
