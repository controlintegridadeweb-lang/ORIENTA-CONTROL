import { getCalendarYearBrt } from "@/features/fami";

/** Retorna o primeiro ano de quatro dígitos declarado no período do ciclo. */
function cyclePeriodYear(periodLabel: string): number | null {
  const match = /(?:^|\D)(20\d{2})(?:\D|$)/.exec(periodLabel);
  return match ? Number(match[1]) : null;
}

export function formQualifiesForRespondentDashboardYear(
  responsesUpdatedInPeriod: number,
  validationsInPeriod: number,
): boolean {
  return responsesUpdatedInPeriod > 0 || validationsInPeriod > 0;
}

/**
 * O filtro anual é real: um diagnóstico entra pelo ano declarado no período ou
 * por atividade ocorrida no exercício. Ciclos ativos não vazam para todos os anos.
 */
export function shouldShowFormOnRespondentDashboardForYear(input: {
  periodYear: number;
  cyclePeriodLabel: string;
  responsesUpdatedInPeriod: number;
  validationsInPeriod: number;
  totalResponsesEver: number;
  formCreatedAtIso: string;
}): boolean {
  const declaredYear = cyclePeriodYear(input.cyclePeriodLabel);
  if (declaredYear != null) return declaredYear === input.periodYear;

  if (
    formQualifiesForRespondentDashboardYear(
      input.responsesUpdatedInPeriod,
      input.validationsInPeriod,
    )
  ) {
    return true;
  }
  if (input.totalResponsesEver > 0) return false;
  return getCalendarYearBrt(input.formCreatedAtIso) === input.periodYear;
}
