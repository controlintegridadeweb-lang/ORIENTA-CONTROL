import type { HistoryFilterState } from "@/features/reports/components/respondent/respondent-reports-filters";
import {
  parseRespondentReportsSearch,
  respondentReportsPath,
} from "@/shared/navigation/report-paths";

export type RespondentReportUrlState = {
  filters: HistoryFilterState;
  offset: number;
};

export function parseRespondentReportUrl(
  params: Pick<URLSearchParams, "get">,
): RespondentReportUrlState {
  const parsed = parseRespondentReportsSearch(params);
  return {
    filters: {
      search: parsed.search,
      status: parsed.status,
      kind: parsed.kind,
      from: parsed.from,
      to: parsed.to,
      yearPreset: parsed.year,
      cycleId: parsed.cycleId,
    },
    offset: parsed.offset,
  };
}

export function respondentReportHistoryPath(
  filters: HistoryFilterState,
  offset = 0,
): string {
  return respondentReportsPath({
    search: filters.search,
    status: filters.status,
    kind: filters.kind,
    from: filters.from,
    to: filters.to,
    year: filters.yearPreset,
    cycleId: filters.cycleId,
    offset,
  });
}
