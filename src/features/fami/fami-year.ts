/** Fuso America/Sao_Paulo (sem horario de verao desde 2019); usado para definir ano civil FAMI. */

export const FAMI_CALENDAR_TIMEZONE = "America/Sao_Paulo";

/**
 * Ano civil (YYYY) da data em BRT, para alinhar fechamento anual institucional.
 */
export function getCalendarYearBrt(isoUtc: string): number {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) {
    return new Date().getUTCFullYear();
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FAMI_CALENDAR_TIMEZONE,
    year: "numeric",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  return y ? Number(y) : d.getUTCFullYear();
}

/**
 * Intervalo UTC [from, to] que cobre 1 Jan–31 Dec BRT para o ano pedido,
 * compativel com `timestamptz` no Postgres (.gte /.lte).
 */
export function brtYearUtcBounds(year: number): { fromInclusive: string; toInclusive: string } {
  if (!Number.isFinite(year) || year < 1900 || year > 2100) {
    throw new RangeError("year");
  }
  const fromInclusive = `${year}-01-01T03:00:00.000Z`;
  const toInclusive = `${year + 1}-01-01T02:59:59.999Z`;
  return { fromInclusive, toInclusive };
}

/** Ano civil em BRT para o instante atual. */
export function currentBrtYear(): number {
  return currentBrtMonthYear().year;
}

/**
 * O FAMI anual só é publicado depois do 31/12 do ano de referência, no horário de Fortaleza.
 * O Resultado FAMI do diagnóstico continua disponível no Panorama e como base do preliminar.
 */
export function isCalendarYearClosed(year: number, now: Date = new Date()): boolean {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new RangeError("year");
  }
  const lastInstant = new Date(`${year}-12-31T23:59:59.999-03:00`);
  return now.getTime() > lastInstant.getTime();
}

/** Mês civil (1–12) e ano em BRT para o instante atual. */
function currentBrtMonthYear(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FAMI_CALENDAR_TIMEZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")?.value ?? new Date().getFullYear());
  const month = Number(parts.find((p) => p.type === "month")?.value ?? 1);
  return { year, month };
}
