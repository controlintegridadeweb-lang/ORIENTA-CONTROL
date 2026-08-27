"use client";

import { useMemo } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import { famiPreliminaryLabels } from "@/shared/labels/official-labels";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { ExportMenu, type ExportMenuOption } from "@/shared/ui/components/export-menu";
import { LoadingButton } from "@/shared/ui/components/loading";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { type Quadrimester } from "@/features/fami/preliminary/domain";
import {
  buildQuadrimesterDisplay,
  formatPreliminaryPercentage,
} from "@/features/fami/preliminary/panel-presentation";
import {
  bimesterRowStatus,
  formatBimesterSummary,
  listBimesterRows,
} from "@/features/fami/preliminary/tracking-presentation";
import type { Bimester } from "@/shared/domain/calendar-periods";
import type { PreliminaryCheckpoint, PreliminaryPayload } from "./use-fami-preliminary";
import { useBimonthlyReports } from "./use-bimonthly-reports";
import { QuadrimesterEvolutionBlock } from "./quadrimester-evolution-block";

type Props = {
  cycleId: string | null | undefined;
  referenceYear: number;
  canMaterialize: boolean;
  payload: PreliminaryPayload;
  loading: boolean;
  submitting: Quadrimester | null;
  error: string | null;
  message: string | null;
  onRetry(): void;
  onCalculate(quadrimester: Quadrimester): void;
};

const BIMONTHLY_EXPORT_OPTIONS: Array<ExportMenuOption<"pdf" | "xlsx">> = [
  {
    format: "pdf",
    label: famiPreliminaryLabels.exportPdf,
    icon: FileText,
    hint: famiPreliminaryLabels.exportPdfHint,
  },
  {
    format: "xlsx",
    label: famiPreliminaryLabels.exportXlsx,
    icon: FileSpreadsheet,
    hint: famiPreliminaryLabels.exportXlsxHint,
  },
];

function downloadCsv(rows: PreliminaryCheckpoint[], cycleId: string): void {
  const header = [
    "tipo_resultado",
    "carater",
    "ano",
    "quadrimestre",
    "versao_calculo",
    "tipo_calculo",
    "metodologia",
    "processamento_oficial",
    "politica_oficial",
    "fami_preliminar_percentual",
    "delta_pontos_percentuais",
    "calculado_em",
    "fechado_em",
  ];
  const lines = rows.map((row) => [
    "FAMI_PRELIMINAR_QUADRIMESTRAL",
    "NAO_OFICIAL",
    row.referenceYear,
    row.quadrimester,
    row.calculationVersion,
    row.calculationKind,
    row.methodologyVersion,
    row.sourceProcessingVersion,
    row.sourcePolicyVersion,
    row.preliminary?.percentage ?? "",
    row.deltaPercentagePoints ?? "",
    row.calculatedAt,
    row.closedAt ?? "",
  ]);
  const escape = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = [header, ...lines].map((line) => line.map(escape).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `fami-preliminar-${cycleId}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportHref(reportId: string, format: "pdf" | "xlsx"): string {
  return `/api/monitoring/bimonthly/${reportId}/export?format=${format}`;
}

function startExportDownload(reportId: string, format: "pdf" | "xlsx"): void {
  const anchor = document.createElement("a");
  anchor.href = exportHref(reportId, format);
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function FamiPreliminaryPanel({
  cycleId,
  referenceYear,
  canMaterialize,
  payload,
  loading,
  submitting,
  error,
  message,
  onRetry,
  onCalculate,
}: Props) {
  const bimonthly = useBimonthlyReports(cycleId, referenceYear);
  const bimonthlyLatest = bimonthly.payload.latestByPeriod;
  const latestByQuadrimester = useMemo(() => {
    const map = new Map<Quadrimester, PreliminaryCheckpoint>();
    for (const row of payload.latestByPeriod) map.set(row.quadrimester, row);
    return map;
  }, [payload.latestByPeriod]);
  const latestByBimester = useMemo(() => {
    const map = new Map<Bimester, (typeof bimonthlyLatest)[number]>();
    for (const row of bimonthlyLatest) map.set(row.bimester, row);
    return map;
  }, [bimonthlyLatest]);
  const evolutionByQuadrimester = useMemo(() => {
    const map = new Map(payload.evolutions.map((row) => [row.quadrimester, row]));
    return map;
  }, [payload.evolutions]);
  const closedBimesters = useMemo(() => {
    const closed = new Set<Bimester>();
    for (const row of bimonthlyLatest) {
      if (row.closedAt) closed.add(row.bimester);
    }
    return closed;
  }, [bimonthlyLatest]);
  const rows = useMemo(
    () =>
      listBimesterRows(referenceYear, {
        officialAvailableAt: payload.tracking.officialAvailableAt,
        closedBimesters,
      }),
    [closedBimesters, payload.tracking.officialAvailableAt, referenceYear],
  );
  const busy = loading || bimonthly.loading;
  const combinedError = error ?? bimonthly.error;
  const actionsBusy = submitting !== null || bimonthly.submitting !== null;

  return (
    <PanelSection
      title={famiPreliminaryLabels.trackingTitle(referenceYear)}
      description={famiPreliminaryLabels.description}
      variant="plain"
      actions={
        cycleId && payload.history.length > 0 ? (
          <button
            type="button"
            className={formSurface.secondaryButtonSm}
            onClick={() => downloadCsv(payload.history, cycleId)}
          >
            {famiPreliminaryLabels.exportHistory}
          </button>
        ) : null
      }
    >
      <div className="space-y-3">
        {busy ? <p className={typography.auxiliary}>Carregando acompanhamento…</p> : null}
        {message ? <p className={formSurface.messageSuccess}>{message}</p> : null}
        {combinedError ? (
          <AsyncErrorState
            compact
            title={
              combinedError === famiPreliminaryLabels.loadError ||
              combinedError.startsWith("Falha ao carregar")
                ? famiPreliminaryLabels.loadError
                : famiPreliminaryLabels.calculateError
            }
            message={combinedError}
            onRetry={
              cycleId
                ? () => {
                    onRetry();
                    void bimonthly.reload();
                  }
                : undefined
            }
            retrying={busy}
          />
        ) : null}

        <div className={formSurface.brandTable.wrapper}>
          <table className={formSurface.brandTable.table}>
            <thead className={formSurface.brandTable.head}>
              <tr>
                <th className={formSurface.brandTable.headCell}>Período</th>
                <th className={formSurface.brandTable.headCell}>Situação</th>
                <th className={formSurface.brandTable.headCell}>Plano de ação</th>
                <th className={formSurface.brandTable.headCell}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const report = latestByBimester.get(row.bimester) ?? null;
                const status = bimesterRowStatus(row, report != null);
                const quadrimester = row.quadrimester;
                const checkpoint = quadrimester
                  ? (latestByQuadrimester.get(quadrimester) ?? null)
                  : null;
                const display = quadrimester
                  ? buildQuadrimesterDisplay({
                      referenceYear,
                      quadrimester,
                      officialAvailableAt: payload.tracking.officialAvailableAt,
                      earliestActionCreatedAt: payload.tracking.earliestActionCreatedAt,
                      checkpoint: checkpoint
                        ? {
                            percentage: checkpoint.preliminary?.percentage,
                            calculatedAt: checkpoint.calculatedAt,
                            closedAt: checkpoint.closedAt,
                            calculationKind: checkpoint.calculationKind,
                          }
                        : null,
                    })
                  : null;
                const canCalculate =
                  canMaterialize &&
                  display &&
                  (display.action === "calculate" || display.action === "recalculate");
                return (
                  <tr
                    key={row.bimester}
                    className={index % 2 === 0 ? formSurface.brandTable.rowEven : formSurface.brandTable.rowOdd}
                  >
                    <td className={formSurface.brandTable.cell}>
                      <p className="font-semibold text-slate-900">
                        {row.label} · {row.shortLabel}
                      </p>
                      <p className={`mt-1 ${typography.meta}`}>
                        {row.rangeLabel} · corte em {row.cutoffLabel}
                      </p>
                    </td>
                    <td className={`${formSurface.brandTable.cell} text-slate-700`}>
                      <p>{status.label}</p>
                      {status.auxiliary ? (
                        <p className={`mt-1 ${typography.meta}`}>{status.auxiliary}</p>
                      ) : null}
                    </td>
                    <td className={`${formSurface.brandTable.cell} text-slate-700`}>
                      <p>{formatBimesterSummary(report?.summary ?? null)}</p>
                      {display ? (
                        <p className={`mt-2 font-medium text-slate-900`}>
                          {famiPreliminaryLabels.panoramaLabel}:{" "}
                          {formatPreliminaryPercentage(display.percentage)}
                        </p>
                      ) : null}
                      {quadrimester && checkpoint ? (
                        <QuadrimesterEvolutionBlock
                          quadrimester={quadrimester}
                          percentage={checkpoint.preliminary?.percentage ?? null}
                          deltaPercentagePoints={checkpoint.deltaPercentagePoints}
                          methodologyVersion={checkpoint.methodologyVersion}
                          evolution={evolutionByQuadrimester.get(quadrimester) ?? null}
                        />
                      ) : null}
                    </td>
                    <td className={formSurface.brandTable.cell}>
                      <div className="flex flex-wrap items-center gap-2">
                        {canMaterialize && row.canGenerateManually ? (
                          <LoadingButton
                            type="button"
                            pending={bimonthly.submitting === row.bimester}
                            pendingLabel={famiPreliminaryLabels.generatingBimester}
                            disabled={actionsBusy}
                            onClick={() => void bimonthly.generate(row.bimester)}
                            className={formSurface.primaryButtonSm}
                            aria-label={`${famiPreliminaryLabels.generateBimester} ${row.label}`}
                          >
                            {famiPreliminaryLabels.generateBimester}
                          </LoadingButton>
                        ) : null}
                        {canCalculate ? (
                          <LoadingButton
                            type="button"
                            pending={submitting === quadrimester}
                            pendingLabel={famiPreliminaryLabels.calculating}
                            disabled={actionsBusy}
                            onClick={() => quadrimester && onCalculate(quadrimester)}
                            className={formSurface.secondaryButtonSm}
                            aria-label={
                              display.action === "recalculate"
                                ? famiPreliminaryLabels.calculateAgain(quadrimester ?? 1)
                                : famiPreliminaryLabels.calculate(quadrimester ?? 1)
                            }
                          >
                            {display.action === "recalculate"
                              ? famiPreliminaryLabels.recalculateRow
                              : famiPreliminaryLabels.calculateRow}
                          </LoadingButton>
                        ) : null}
                        {report ? (
                          <ExportMenu
                            label={famiPreliminaryLabels.exportMenu}
                            options={BIMONTHLY_EXPORT_OPTIONS}
                            disabled={actionsBusy}
                            onExport={async (format) => {
                              startExportDownload(report.id, format);
                            }}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PanelSection>
  );
}
