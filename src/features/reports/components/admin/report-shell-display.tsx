import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import type { ReportHistoryOption } from "@/features/reports/ui/client";

export function ReportModeBadge({ label }: { label: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-micro font-semibold uppercase tracking-wide text-slate-600 shadow-sm"
      title="Nível de acesso ao relatório"
    >
      {label}
    </span>
  );
}

export function formatReportDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Data não informada"
    : formatPlatformDateTime(date, { dateStyle: "medium", timeStyle: "short" });
}

export function reportDownloadFilename(report: ReportHistoryOption): string {
  const safeName = report.formName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();
  return `relatorio-orienta-${safeName || "diagnostico"}-processamento-${report.processingVersion}-emissao-${report.emissionVersion}-${report.id.slice(0, 8)}.pdf`;
}
