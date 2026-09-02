"use client";

import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import { Download, ExternalLink } from "lucide-react";
import type { RespondentReportHistoryRow } from "@/features/reports/ui/respondent-presentation";
import { catalogKindLabel } from "@/features/reports/report-catalog";
import { reportCatalogLabels } from "@/shared/labels/official-labels";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import { RespondentReportsEmptyState } from "./respondent-reports-empty-state";

const HISTORY_META_LABEL = "text-xs text-slate-600";
const HISTORY_META_VALUE = "mt-0.5 font-medium text-slate-900";

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return formatPlatformDateTime(date, { dateStyle: "medium", timeStyle: "short" });
}

type Props = {
  items: RespondentReportHistoryRow[];
  onDownload: (row: RespondentReportHistoryRow) => void;
  onOpen: (row: RespondentReportHistoryRow) => void;
  emptyKind?: "" | "annual" | "bimonthly";
  emptyOriginHref?: string | null;
};

function HistoryReportRow({
  row,
  outdated,
  onDownload,
  onOpen,
}: {
  row: RespondentReportHistoryRow;
  outdated: boolean;
  onDownload: () => void;
  onOpen: () => void;
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

        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            className={`${formSurface.secondaryButtonSm} w-full sm:w-auto`}
            onClick={onOpen}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            {reportCatalogLabels.openPdf}
          </button>
          <button
            type="button"
            className={`${formSurface.secondaryButtonSm} w-full sm:w-auto`}
            onClick={onDownload}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Baixar
          </button>
        </div>
      </div>

      <dl className="grid gap-4 bg-slate-50/60 px-4 py-4 text-sm sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
        <div>
          <dt className={HISTORY_META_LABEL}>Emissão</dt>
          <dd className={HISTORY_META_VALUE}>v{row.emissionVersion}</dd>
        </div>
        {row.catalogKind === "bimonthly" && row.bimester != null ? (
          <div>
            <dt className={HISTORY_META_LABEL}>Bimestre</dt>
            <dd className={HISTORY_META_VALUE}>{row.bimester}º</dd>
          </div>
        ) : (
          <div>
            <dt className={HISTORY_META_LABEL}>Processamento</dt>
            <dd className={HISTORY_META_VALUE}>nº {row.processingVersion}</dd>
          </div>
        )}
        {row.catalogKind === "annual" ? (
          <div>
            <dt className={HISTORY_META_LABEL}>Política FAMI</dt>
            <dd className={HISTORY_META_VALUE}>{row.policyVersion}</dd>
          </div>
        ) : null}
        {row.formTemplateVersion != null ? (
          <div>
            <dt className={HISTORY_META_LABEL}>Template</dt>
            <dd className={HISTORY_META_VALUE}>v{row.formTemplateVersion}</dd>
          </div>
        ) : null}
        {row.fileSha256 ? (
          <div className="min-w-0 sm:col-span-2 lg:col-span-4">
            <dt className={HISTORY_META_LABEL}>SHA-256</dt>
            <dd
              className="mt-0.5 truncate font-mono text-xs font-medium text-slate-900"
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
    </li>
  );
}

export function RespondentReportsHistoryList({
  items,
  onDownload,
  onOpen,
  emptyKind = "",
  emptyOriginHref,
}: Props) {
  if (items.length === 0) {
    return (
      <RespondentReportsEmptyState
        variant="no-reports"
        kind={emptyKind}
        originHref={emptyOriginHref}
      />
    );
  }

  return (
    <ul className="space-y-3" role="list" aria-label="Histórico de relatórios">
      {items.map((row) => (
        <HistoryReportRow
          key={row.id}
          row={row}
          outdated={!row.isCurrent}
          onDownload={() => onDownload(row)}
          onOpen={() => onOpen(row)}
        />
      ))}
    </ul>
  );
}
