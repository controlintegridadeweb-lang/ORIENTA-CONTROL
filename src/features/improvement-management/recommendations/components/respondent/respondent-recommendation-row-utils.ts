import { formatPlatformDate } from "@/shared/datetime/platform-date-time";

/** Resumo curto para headers de workspace (não usar como título do card de lista). */
export function firstLineRecommendation(text: string): string {
  const line = text.split(/\n+/)[0]?.trim() ?? "";
  if (!line) return "Recomendação";
  return line.length > 180 ? `${line.slice(0, 177)}…` : line;
}

export function formatRecommendationDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatPlatformDate(d, { day: "2-digit", month: "short", year: "numeric" });
}
