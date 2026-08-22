/** Parâmetros de URL compartilhados entre listagens admin (Recomendações e Plano de ação). */

export type AdminListLayout = "list" | "organization";

export type AdminListUrlFilters = {
  search: string;
  organizationId: string;
  formId: string;
  cycleId: string;
  axisId: string;
  status: string;
  from: string;
  to: string;
};

export function parseAdminListPage(params: Pick<URLSearchParams, "get">): number {
  const page = Number(params.get("page"));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function parseAdminListCardFilter<T extends string>(
  params: Pick<URLSearchParams, "get">,
  allowed: readonly T[],
): T | null {
  const card = params.get("card");
  return card && allowed.includes(card as T) ? (card as T) : null;
}

export function parseAdminListLayout(
  params: URLSearchParams,
): AdminListLayout {
  const layout = params.get("layout");
  if (layout === "organization") return "organization";
  if (layout === "list") return "list";
  return "list";
}

export function parseAdminListUrlFilters(
  params: URLSearchParams,
  opts: { includeAxis?: boolean } = {},
): Partial<AdminListUrlFilters> {
  const partial: Partial<AdminListUrlFilters> = {
    search: params.get("q") ?? undefined,
    organizationId: params.get("organizationId") ?? undefined,
    formId: params.get("formId") ?? undefined,
    cycleId: params.get("cycleId") ?? undefined,
    status: params.get("status") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  };
  if (opts.includeAxis) {
    const axisId = params.get("axisId");
    if (axisId != null) partial.axisId = axisId;
  }
  return partial;
}

export function buildAdminListSearchParams(input: {
  layout: AdminListLayout;
  filters: AdminListUrlFilters;
  includeAxis?: boolean;
  page?: number;
  cardFilter?: string | null;
}): URLSearchParams {
  const { layout, filters, includeAxis, page, cardFilter } = input;
  const params = new URLSearchParams();
  params.set("layout", layout);
  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (filters.organizationId) params.set("organizationId", filters.organizationId);
  if (filters.formId) params.set("formId", filters.formId);
  if (filters.cycleId) params.set("cycleId", filters.cycleId);
  if (includeAxis && filters.axisId) params.set("axisId", filters.axisId);
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (cardFilter?.trim()) params.set("card", cardFilter.trim());
  if (page != null && Number.isInteger(page) && page > 1) params.set("page", String(page));
  return params;
}
