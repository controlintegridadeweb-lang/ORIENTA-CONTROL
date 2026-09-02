import { parseUuidParam } from "@/shared/validation/uuid";

export const REPORT_CATALOG_KIND_PARAMS = ["annual", "bimonthly"] as const;
export type ReportCatalogKindParam = (typeof REPORT_CATALOG_KIND_PARAMS)[number];

export type AdminReportsQuery = {
  organizationId?: string | null;
  cycleId?: string | null;
  offset?: number;
  kind?: ReportCatalogKindParam | "";
};

export type RespondentReportsQuery = {
  search?: string;
  status?: "completed" | "outdated" | "";
  kind?: ReportCatalogKindParam | "";
  from?: string;
  to?: string;
  year?: number | null;
  cycleId?: string | null;
  offset?: number;
};

export function parseReportCatalogKind(
  value: string | null | undefined,
): ReportCatalogKindParam | "" {
  return value === "annual" || value === "bimonthly" ? value : "";
}

function localDate(value: string | null): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function setUuid(params: URLSearchParams, key: string, value: string | null | undefined): void {
  const id = parseUuidParam(value ?? undefined);
  if (id) params.set(key, id);
}

/** Catálogo administrativo: emissão anual + histórico. `kind` recorta só o histórico. */
export function adminReportsPath(query: AdminReportsQuery = {}): string {
  const params = new URLSearchParams();
  setUuid(params, "organizationId", query.organizationId);
  setUuid(params, "cycleId", query.cycleId);
  if (query.kind === "annual" || query.kind === "bimonthly") params.set("kind", query.kind);
  if (query.offset && query.offset > 0) params.set("offset", String(query.offset));
  const search = params.toString();
  return search ? `/admin/relatorios?${search}` : "/admin/relatorios";
}

export function adminBimonthlyReportsPath(input: {
  organizationId?: string | null;
  cycleId?: string | null;
}): string {
  return adminReportsPath({
    organizationId: input.organizationId,
    cycleId: input.cycleId,
    kind: "bimonthly",
  });
}

export function parseRespondentReportsSearch(
  params: Pick<URLSearchParams, "get">,
): Required<Pick<RespondentReportsQuery, "search" | "status" | "kind" | "from" | "to">> & {
  year: number | null;
  cycleId: string;
  offset: number;
} {
  const rawStatus = params.get("status");
  const rawYear = Number(params.get("year"));
  const rawOffset = Number(params.get("offset"));
  return {
    search: params.get("search")?.slice(0, 200) ?? "",
    status: rawStatus === "completed" || rawStatus === "outdated" ? rawStatus : "",
    kind: parseReportCatalogKind(params.get("kind")),
    from: localDate(params.get("from")),
    to: localDate(params.get("to")),
    year: Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= 2200 ? rawYear : null,
    cycleId: parseUuidParam(params.get("cycleId")) ?? "",
    offset: Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0,
  };
}

export function respondentReportsPath(query: RespondentReportsQuery = {}): string {
  const params = new URLSearchParams();
  const search = query.search?.trim();
  if (search) params.set("search", search);
  if (query.status === "completed" || query.status === "outdated") {
    params.set("status", query.status);
  }
  if (query.kind === "annual" || query.kind === "bimonthly") params.set("kind", query.kind);
  if (query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from)) params.set("from", query.from);
  if (query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) params.set("to", query.to);
  if (query.year != null && Number.isInteger(query.year) && query.year >= 2000 && query.year <= 2200) {
    params.set("year", String(query.year));
  }
  setUuid(params, "cycleId", query.cycleId);
  if (query.offset && query.offset > 0) params.set("offset", String(query.offset));
  const encoded = params.toString();
  return encoded ? `/respondente/relatorios?${encoded}` : "/respondente/relatorios";
}

export function respondentBimonthlyReportsPath(input: { cycleId?: string | null } = {}): string {
  return respondentReportsPath({ cycleId: input.cycleId, kind: "bimonthly" });
}
