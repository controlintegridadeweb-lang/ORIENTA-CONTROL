import {
  clampRespondentDashboardYear,
  defaultRespondentDashboardYear,
} from "@/features/respondent-progress/respondent-dashboard-year";

export function respondentDashboardYearFromSearchParams(
  value: string | undefined,
): number {
  if (!value) return defaultRespondentDashboardYear();
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed)
    ? clampRespondentDashboardYear(parsed)
    : defaultRespondentDashboardYear();
}
