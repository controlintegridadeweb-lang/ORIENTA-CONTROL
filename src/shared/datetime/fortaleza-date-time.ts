import { PLATFORM_TIME_ZONE, PLATFORM_TIME_ZONE_LABEL } from "@/shared/datetime/platform-date-time";

export { PLATFORM_TIME_ZONE_LABEL };

/** Converte um instante em valor de `datetime-local` no fuso oficial da plataforma. */
export function toFortalezaDateTimeInput(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PLATFORM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
}

/** Interpreta o valor sem fuso do input como horário de Fortaleza (UTC−3). */
export function parseFortalezaDateTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function asFortalezaIso(value: string): string | null {
  return parseFortalezaDateTime(value)?.toISOString() ?? null;
}
