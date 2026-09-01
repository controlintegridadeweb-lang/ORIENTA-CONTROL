"use client";

import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import Link from "next/link";
import { Download, History } from "lucide-react";
import type { RespondentReportHistoryRow } from "@/features/reports/ui/respondent-presentation";
import { catalogKindLabel } from "@/features/reports/report-catalog";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import { RespondentReportsEmptyState } from "./respondent-reports-empty-state";

const ACTION_BTN =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/30";

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return formatPlatformDateTime(date, { dateStyle: "medium", timeStyle: "short" });
}

type Props = {
  items: RespondentReportHistoryRow[];
  onDownload: (row: RespondentReportHistoryRow) => void;
};

function HistoryReportRow({
  row,
  outdated,
  onDownload,
}: {
  row: RespondentReportHistoryRow;
  outdated: boolean;
  onDownload: () => void;
}) {
  return (
    <li className={`${formSurface.entityListCard} overflow-hidden`}>
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={typography.cardTitle}>{row.formName}</h3>
            <span
              className={`${formSurface.badge.base} ${
                row.catalogKind === "bimonthly" ? formSurface.badge.info : formSurface.badge.brand
              }`}
            >
              {catalogKindLabel(row.catalogKind, row.referenceStartYear)}
            </span>
            {outdated ? (
              <span className={`${formSurface.badge.base} ${formSurface.badge.warning}`}>
                Versão anterior
              </span>
            ) : null}
          </div>
          <p className={`mt-1 ${typography.cardDescription}`}>
            <time dateTime={row.generatedAt}>{formatWhen(row.generatedAt)}</time>
            {" · "}
            {row.periodLabel}
            {" · "}
            {row.generatedByLabel}
          </p>
        </div>

        <div
          className="flex shrink-0 flex-wrap items-center gap-1"
          role="toolbar"
          aria-label={`Ações para ${row.formName}`}
        >
          <button type="button" className={ACTION_BTN} title="Baixar PDF oficial" onClick={onDownload}>
            <Download className="h-4 w-4" aria-hidden />
            <span className="sr-only">Baixar</span>
          </button>
        </div>
      </div>

      <dl className="grid gap-4 bg-slate-50/60 px-4 py-4 text-sm sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
        <div>
          <dt className={typography.meta}>Emissão</dt>
          <dd className="mt-0.5 font-medium text-slate-800">v{row.emissionVersion}</dd>
        </div>
        {row.catalogKind === "bimonthly" && row.bimester != null ? (
          <div>
            <dt className={typography.meta}>Bimestre</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{row.bimester}º</dd>
          </div>
        ) : (
          <div>
            <dt className={typography.meta}>Processamento</dt>
            <dd className="mt-0.5 font-medium text-slate-800">nº {row.processingVersion}</dd>
          </div>
        )}
        {row.catalogKind === "annual" ? (
          <div>
            <dt className={typography.meta}>Política FAMI</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{row.policyVersion}</dd>
          </div>
        ) : null}
        {row.formTemplateVersion != null ? (
          <div>
            <dt className={typography.meta}>Template</dt>
            <dd className="mt-0.5 font-medium text-slate-800">v{row.formTemplateVersion}</dd>
          </div>
        ) : null}
        {row.fileSha256 ? (
          <div className="min-w-0 sm:col-span-2 lg:col-span-4">
            <dt className={typography.meta}>SHA-256</dt>
            <dd
              className="mt-0.5 truncate font-mono text-xs font-medium text-slate-700"
              title={row.fileSha256}
            >
              {row.fileSha256.slice(0, 16)}…
            </dd>
          </div>
        ) : null}
      </dl>

      {row.outdatedReason ? (
        <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
          <p className="text-sm font-medium text-amber-800">{row.outdatedReason}</p>
        </div>
      ) : null}

      {row.catalogKind === "annual" ? (
        <nav
          className="border-t border-slate-100 px-4 py-3 sm:px-5"
          aria-label={`Abrir versão do relatório ${row.formName}`}
        >
          <Link
            href={`/respondente/relatorios/${encodeURIComponent(row.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-800 hover:underline"
          >
            <History className="h-4 w-4" aria-hidden />
            Abrir emissão imutável em nova aba
          </Link>
        </nav>
      ) : null}
    </li>
  );
}

export function RespondentReportsHistoryList({
  items,
  onDownload,
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
        />
      ))}
    </ul>
  );
}
