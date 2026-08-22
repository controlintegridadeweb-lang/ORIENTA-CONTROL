import { PLATFORM_TIME_ZONE } from "@/shared/datetime/platform-date-time";

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type LocalDateParts = { year: number; month: number; day: number };

function parseLocalDate(value: string): LocalDateParts | null {
  const match = LOCAL_DATE_PATTERN.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}


export type BusinessDateBoundary = "start" | "end";

function zonedDateTimeParts(instant: Date): Required<LocalDateParts> & {
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PLATFORM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  function numberPart(type: Intl.DateTimeFormatPartTypes): number {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) throw new Error("Não foi possível converter a data institucional.");
    return Number(value);
  }

  return {
    year: numberPart("year"),
    month: numberPart("month"),
    day: numberPart("day"),
    hour: numberPart("hour"),
    minute: numberPart("minute"),
    second: numberPart("second"),
  };
}

/**
 * Converte o início ou fim de um dia institucional para um instante UTC.
 * A conversão usa o fuso oficial em vez do fuso do navegador ou de offset fixo.
 */
export function businessDateBoundaryIso(
  value: string,
  boundary: BusinessDateBoundary,
): string {
  const date = parseLocalDate(value);
  if (!date) throw new Error(`Data local inválida: ${value}`);

  const hour = boundary === "start" ? 0 : 23;
  const minute = boundary === "start" ? 0 : 59;
  const second = boundary === "start" ? 0 : 59;
  const millisecond = boundary === "start" ? 0 : 999;
  const targetLocalAsUtc = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    hour,
    minute,
    second,
  );

  let instantMs = targetLocalAsUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = zonedDateTimeParts(new Date(instantMs));
    const observedLocalAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    );
    const correction = targetLocalAsUtc - observedLocalAsUtc;
    if (correction === 0) break;
    instantMs += correction;
  }

  return new Date(instantMs + millisecond).toISOString();
}

export function isLocalDate(value: string): boolean {
  return parseLocalDate(value) !== null;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toLocalDateString(parts: LocalDateParts): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function businessToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PLATFORM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Não foi possível determinar a data institucional.");
  }

  return `${year}-${month}-${day}`;
}

export function addCalendarDays(value: string, days: number): string {
  const parts = parseLocalDate(value);
  if (!parts) throw new Error(`Data local inválida: ${value}`);

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + days);
  return toLocalDateString({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

export function businessDateAfter(days: number, now: Date = new Date()): string {
  return addCalendarDays(businessToday(now), days);
}

export function formatLocalDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
  },
): string {
  if (!value) return "—";
  const parts = parseLocalDate(value.slice(0, 10));
  if (!parts) return "—";

  const neutralInstant = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
  return new Intl.DateTimeFormat("pt-BR", {
    ...options,
    timeZone: "UTC",
  }).format(neutralInstant);
}
