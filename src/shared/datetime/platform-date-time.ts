export const PLATFORM_TIME_ZONE = "America/Fortaleza";
const PLATFORM_LOCALE = "pt-BR";
export const PLATFORM_TIME_ZONE_LABEL = "horário oficial da plataforma — Fortaleza, UTC−3";

function toValidDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatPlatformDateTime(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
  fallback = "—",
): string {
  const date = toValidDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(PLATFORM_LOCALE, {
    ...options,
    timeZone: PLATFORM_TIME_ZONE,
  }).format(date);
}

export function formatPlatformDate(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
  fallback = "—",
): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const civilDate = new Date(Date.UTC(year, month - 1, day, 12));
    const valid =
      civilDate.getUTCFullYear() === year &&
      civilDate.getUTCMonth() === month - 1 &&
      civilDate.getUTCDate() === day;
    if (!valid) return fallback;
    return new Intl.DateTimeFormat(PLATFORM_LOCALE, {
      ...options,
      timeZone: "UTC",
    }).format(civilDate);
  }
  return formatPlatformDateTime(value, options, fallback);
}

export function formatPlatformTime(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" },
  fallback = "—",
): string {
  return formatPlatformDateTime(value, options, fallback);
}
