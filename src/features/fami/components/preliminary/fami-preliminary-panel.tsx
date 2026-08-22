"use client";

import { useMemo, useState } from "react";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import { famiPreliminaryLabels } from "@/shared/labels/official-labels";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { LoadingButton } from "@/shared/ui/components/loading";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { type Quadrimester } from "@/features/fami/preliminary/domain";
import {
  buildQuadrimesterDisplay,
  formatPreliminaryPercentage,
  quadrimesterAvailability,
  type QuadrimesterRowKind,
} from "@/features/fami/preliminary/panel-presentation";
import type {
  PreliminaryCheckpoint,
  PreliminaryPayload,
} from "./use-fami-preliminary";

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

const ROW_STATUS: Record<QuadrimesterRowKind, string> = {
  upcoming: famiPreliminaryLabels.statusUpcoming,
  not_implemented: famiPreliminaryLabels.statusNotImplemented,
  open: famiPreliminaryLabels.statusOpen,
  open_calculated: famiPreliminaryLabels.statusOpen,
  completed: famiPreliminaryLabels.statusCompleted,
};

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
  const [detailsFor, setDetailsFor] = useState<Quadrimester | null>(null);
  const latestByQuadrimester = useMemo(() => {
    const map = new Map<Quadrimester, PreliminaryCheckpoint>();
    for (const row of payload.latestByPeriod) map.set(row.quadrimester, row);
    return map;
  }, [payload.latestByPeriod]);

  const periods = useMemo(
    () =>
      ([1, 2, 3] as const).map((quadrimester) => {
        const availability = quadrimesterAvailability(referenceYear, quadrimester);
        const latest = latestByQuadrimester.get(quadrimester) ?? null;
        const display = buildQuadrimesterDisplay({
          referenceYear,
          quadrimester,
          officialAvailableAt: payload.tracking.officialAvailableAt,
          earliestActionCreatedAt: payload.tracking.earliestActionCreatedAt,
          checkpoint: latest
            ? {
                percentage: latest.preliminary?.percentage,
                calculatedAt: latest.calculatedAt,
                closedAt: latest.closedAt,
                calculationKind: latest.calculationKind,
              }
            : null,
        });
        return { quadrimester, availability, latest, display };
      }),
    [latestByQuadrimester, payload.tracking, referenceYear],
  );

  return (
    <PanelSection
      title={famiPreliminaryLabels.title}
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
        {loading ? (
          <p className={typography.auxiliary}>Carregando acompanhamento quadrimestral…</p>
        ) : null}
        {message ? <p className={formSurface.messageSuccess}>{message}</p> : null}
        {error ? (
          <AsyncErrorState
            compact
            title={
              error === famiPreliminaryLabels.loadError ||
              error.startsWith("Falha ao carregar")
                ? famiPreliminaryLabels.loadError
                : famiPreliminaryLabels.calculateError
            }
            message={error}
            onRetry={cycleId ? onRetry : undefined}
            retrying={loading}
          />
        ) : null}

        <div className={formSurface.brandTable.wrapper}>
          <table className={formSurface.brandTable.table}>
            <thead className={formSurface.brandTable.head}>
              <tr>
                <th className={formSurface.brandTable.headCell}>Período</th>
                <th className={formSurface.brandTable.headCell}>Situação</th>
                <th className={formSurface.brandTable.headCell}>{famiPreliminaryLabels.panoramaLabel}</th>
                <th className={formSurface.brandTable.headCell}>Evolução</th>
                <th className={formSurface.brandTable.headCell}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {periods.map(({ quadrimester, availability, latest, display }, index) => {
                const detailsOpen = detailsFor === quadrimester;
                return (
                  <tr
                    key={quadrimester}
                    className={index % 2 === 0 ? formSurface.brandTable.rowEven : formSurface.brandTable.rowOdd}
                  >
                    <td className={formSurface.brandTable.cell}>
                      <p className="font-semibold text-slate-900">{availability.periodLabel}</p>
                      <p className={`mt-1 ${typography.meta}`}>
                        {availability.rangeLabel} · corte em {availability.cutoffLabel}
                      </p>
                    </td>
                    <td className={`${formSurface.brandTable.cell} text-slate-700`}>
                      <p>{ROW_STATUS[display.kind]}</p>
                      {display.auxiliary ? (
                        <p className={`mt-1 ${typography.meta}`}>{display.auxiliary}</p>
                      ) : null}
                      {display.reason ? (
                        <p className={`mt-1 ${typography.meta}`}>{display.reason}</p>
                      ) : null}
                    </td>
                    <td className={`${formSurface.brandTable.cell} font-medium text-slate-900`}>
                      {formatPreliminaryPercentage(display.percentage)}
                    </td>
                    <td className={`${formSurface.brandTable.cell} text-slate-700`}>
                      {display.percentage == null || latest?.deltaPercentagePoints == null
                        ? "—"
                        : `${latest.deltaPercentagePoints >= 0 ? "+" : ""}${formatPreliminaryPercentage(latest.deltaPercentagePoints)}`}
                    </td>
                    <td className={formSurface.brandTable.cell}>
                      {canMaterialize &&
                      (display.action === "calculate" || display.action === "recalculate") ? (
                        <LoadingButton
                          type="button"
                          pending={submitting === quadrimester}
                          pendingLabel={famiPreliminaryLabels.calculating}
                          disabled={submitting !== null}
                          onClick={() => onCalculate(quadrimester)}
                          className={formSurface.primaryButtonSm}
                          aria-label={
                            display.action === "recalculate"
                              ? famiPreliminaryLabels.calculateAgain(quadrimester)
                              : famiPreliminaryLabels.calculate(quadrimester)
                          }
                        >
                          {display.action === "recalculate"
                            ? famiPreliminaryLabels.recalculateRow
                            : famiPreliminaryLabels.calculateRow}
                        </LoadingButton>
                      ) : display.action === "view_details" && latest ? (
                        <div className="space-y-2">
                          <button
                            type="button"
                            className={formSurface.secondaryButtonSm}
                            onClick={() => setDetailsFor(detailsOpen ? null : quadrimester)}
                          >
                            {detailsOpen
                              ? famiPreliminaryLabels.hideDetails
                              : famiPreliminaryLabels.viewDetails}
                          </button>
                          {detailsOpen ? (
                            <div className={`${typography.meta} space-y-1`}>
                              <p>
                                {formatPreliminaryPercentage(latest.preliminary?.percentage)}
                                {latest.preliminary?.maturityLevel != null
                                  ? ` · nível ${latest.preliminary.maturityLevel}`
                                  : ""}
                              </p>
                              <p>Metodologia {latest.methodologyVersion}</p>
                              <p>
                                Tipo: {latest.calculationKind === "automatic" ? "automático" : "manual"}
                              </p>
                              {latest.deltaPercentagePoints != null ? (
                                <p>
                                  Evolução vs. base oficial:{" "}
                                  {`${latest.deltaPercentagePoints >= 0 ? "+" : ""}${formatPreliminaryPercentage(latest.deltaPercentagePoints)}`}
                                </p>
                              ) : null}
                              <p>{famiPreliminaryLabels.closedPeriodHint}</p>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className={typography.auxiliary}>—</span>
                      )}
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
