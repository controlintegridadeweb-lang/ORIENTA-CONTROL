import { formatPlatformDate, formatPlatformDateTime, formatPlatformTime } from "@/shared/datetime/platform-date-time";

/** Exibição amigável da última atualização da pontuação FAMI. */
export function formatFamiUpdatedAt(iso: string | null | undefined): string {
  if (!iso) return "Ainda não calculada para este escopo";
  return formatPlatformDateTime(
    iso,
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
    iso,
  );
}

/** Valor curto para cards de KPI (data + hora em linhas separadas). */
export function formatFamiUpdatedAtMetric(iso: string | null | undefined): {
  value: string;
  secondary: string;
  title: string;
} {
  if (!iso) {
    return {
      value: "—",
      secondary: "Consolidado na conclusão do diagnóstico",
      title: "Ainda não calculada para este escopo",
    };
  }

  const value = formatPlatformDate(
    iso,
    { day: "2-digit", month: "2-digit", year: "numeric" },
    iso,
  );
  const time = formatPlatformTime(iso, { hour: "2-digit", minute: "2-digit" }, "");
  return {
    value,
    secondary: `${time} · Consolidado na conclusão do diagnóstico`,
    title: formatFamiUpdatedAt(iso),
  };
}
