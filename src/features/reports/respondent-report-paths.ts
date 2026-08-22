import type { HistoryFilterState } from "@/features/reports/components/respondent/respondent-reports-filters";

export type RespondentReportUrlState = {
  filters: HistoryFilterState;
  offset: number;
};

const DEFAULT_FILTERS: HistoryFilterState = {
  search: "",
  status: "",
  from: "",
  to: "",
  yearPreset: null,
};

function localDate(value: string | null): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

export function parseRespondentReportUrl(
  params: Pick<URLSearchParams, "get">,
): RespondentReportUrlState {
  const rawStatus = params.get("status");
  const rawYear = Number(params.get("year"));
  const rawOffset = Number(params.get("offset"));
  return {
    filters: {
      ...DEFAULT_FILTERS,
      search: params.get("search")?.slice(0, 200) ?? "",
      status:
        rawStatus === "completed" || rawStatus === "outdated" ? rawStatus : "",
      from: localDate(params.get("from")),
      to: localDate(params.get("to")),
      yearPreset:
        Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= 2200 ? rawYear : null,
    },
    offset: Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0,
  };
}

export function respondentReportHistoryPath(
  filters: HistoryFilterState,
  offset = 0,
): string {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.yearPreset != null) params.set("year", String(filters.yearPreset));
  if (offset > 0) params.set("offset", String(offset));
  const query = params.toString();
  return query ? `/respondente/relatorios?${query}` : "/respondente/relatorios";
}
