import { currentBrtYear } from "@/features/fami";

/** Ano civil BRT mínimo para dados e filtro do dashboard do respondente. */
export const RESPONDENT_DASHBOARD_MIN_YEAR = 2026;

/** Ano civil BRT máximo exibido no seletor do dashboard do respondente. */
export const RESPONDENT_DASHBOARD_MAX_YEAR = 2030;

export function clampRespondentDashboardYear(year: number): number {
  return Math.min(
    RESPONDENT_DASHBOARD_MAX_YEAR,
    Math.max(RESPONDENT_DASHBOARD_MIN_YEAR, year),
  );
}

/** Ano padrão: BRT atual, limitado a [2026, 2030]. */
export function defaultRespondentDashboardYear(): number {
  return clampRespondentDashboardYear(currentBrtYear());
}

/** Opções do seletor (mais recente primeiro). */
export function respondentDashboardYearOptions(): number[] {
  const years: number[] = [];
  for (let y = RESPONDENT_DASHBOARD_MAX_YEAR; y >= RESPONDENT_DASHBOARD_MIN_YEAR; y--) {
    years.push(y);
  }
  return years;
}
