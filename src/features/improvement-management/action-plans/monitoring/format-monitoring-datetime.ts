import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";

export function formatMonitoringDateTime(iso: string | null | undefined): string {
  return formatPlatformDateTime(iso, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
