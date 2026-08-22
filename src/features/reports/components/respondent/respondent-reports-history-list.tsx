"use client";

import { typography } from "@/shared/layout/design-system";

import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import Link from "next/link";
import { Download, Eye, FileText, History, Share2 } from "lucide-react";
import type { RespondentReportHistoryRow } from "@/features/reports/ui/respondent-presentation";
import { REPORT_KIND_META } from "@/features/reports/ui/respondent-presentation";
import { RespondentReportsEmptyState } from "./respondent-reports-empty-state";

const ACTION_BTN =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/30";

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return formatPlatformDateTime(date, { dateStyle: "medium", timeStyle: "short" });
}

function HistoryStatusBadge({ outdated }: { outdated: boolean }) {
  return outdated ? (
    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
      Versão anterior
    </span>
  ) : (
    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
      Atual
    </span>
  );
}

type Props = {
  items: RespondentReportHistoryRow[];
  onDownload: (row: RespondentReportHistoryRow) => void;
  onPreview: (row: RespondentReportHistoryRow) => void;
  onShare: (row: RespondentReportHistoryRow) => void;
};

function HistoryReportRow({
  row,
  outdated,
  onDownload,
  onPreview,
  onShare,
}: {
  row: RespondentReportHistoryRow;
  outdated: boolean;
  onDownload: () => void;
  onPreview: () => void;
  onShare: () => void;
}) {
  const kindLabel = REPORT_KIND_META[row.reportKind].label;

  return (
    <li className="group rounded-xl border border-slate-200/80 bg-white p-4 shadow-card transition-[border-color,box-shadow] hover:border-slate-300/90 hover:shadow-card-hover sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-5">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <FileText className="h-4 w-4 text-slate-400" aria-hidden />
            <h3 className={typography.cardTitle}>{row.formName}</h3>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-slate-600">
              {kindLabel}
            </span>
            <span className="rounded-md bg-slate-50 px-2 py-0.5 text-2xs font-medium text-slate-500 ring-1 ring-slate-200/80">
              PDF
            </span>
            <HistoryStatusBadge outdated={outdated} />
          </div>

          <p className="text-xs leading-relaxed text-slate-500">
            <time dateTime={row.generatedAt} className="font-medium text-slate-600">
              {formatWhen(row.generatedAt)}
            </time>
            <span className="mx-1.5 text-slate-300" aria-hidden>·</span>
            {row.periodLabel}
            <span className="mx-1.5 text-slate-300" aria-hidden>·</span>
            Emissão v{row.emissionVersion} · Processamento nº {row.processingVersion} · Política FAMI {row.policyVersion}
            {row.formTemplateVersion != null ? (
              <>
                <span className="mx-1.5 text-slate-300" aria-hidden>·</span>
                Template v{row.formTemplateVersion}
              </>
            ) : null}
            <span className="mx-1.5 text-slate-300" aria-hidden>·</span>
            {row.generatedByLabel}
          </p>
          {row.outdatedReason ? (
            <p className="text-xs font-medium text-amber-700">{row.outdatedReason}</p>
          ) : null}
          {row.fileSha256 ? (
            <p className="font-mono text-2xs text-slate-400" title={row.fileSha256}>
              SHA-256: {row.fileSha256.slice(0, 16)}…
            </p>
          ) : null}
        </div>

        <div
          className="flex shrink-0 flex-wrap items-center gap-1 border-t border-slate-100 pt-3 lg:border-t-0 lg:pt-0"
          role="toolbar"
          aria-label={`Ações para ${row.formName}`}
        >
          <button type="button" className={ACTION_BTN} title="Baixar PDF oficial" onClick={onDownload}>
            <Download className="h-4 w-4" aria-hidden />
            <span className="sr-only">Baixar</span>
          </button>
          <button type="button" className={ACTION_BTN} title="Visualizar PDF oficial" onClick={onPreview}>
            <Eye className="h-4 w-4" aria-hidden />
            <span className="sr-only">Visualizar</span>
          </button>
          <button type="button" className={ACTION_BTN} title="Compartilhar PDF oficial" onClick={onShare}>
            <Share2 className="h-4 w-4" aria-hidden />
            <span className="sr-only">Compartilhar</span>
          </button>
        </div>
      </div>
      <nav className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3" aria-label={`Abrir versão do relatório ${row.formName}`}>
        <Link
          href={`/respondente/relatorios/${encodeURIComponent(row.id)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:underline"
        >
          <History className="h-3.5 w-3.5" aria-hidden />
          Abrir emissão imutável em nova aba
        </Link>
      </nav>
    </li>
  );
}

export function RespondentReportsHistoryList({
  items,
  onDownload,
  onPreview,
  onShare,
}: Props) {
  if (items.length === 0) return <RespondentReportsEmptyState variant="no-reports" />;

  return (
    <ul className="space-y-3" role="list" aria-label="Histórico de relatórios">
      {items.map((row) => (
        <HistoryReportRow
          key={row.id}
          row={row}
          outdated={!row.isCurrent}
          onDownload={() => onDownload(row)}
          onPreview={() => onPreview(row)}
          onShare={() => onShare(row)}
        />
      ))}
    </ul>
  );
}
