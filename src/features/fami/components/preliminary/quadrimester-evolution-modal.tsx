"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import { famiPreliminaryLabels } from "@/shared/labels/official-labels";
import { criterionEvolutionLabel } from "@/features/fami/preliminary/evolution";
import { formatPreliminaryPercentage } from "@/features/fami/preliminary/panel-presentation";
import { trapTabFocus } from "@/shared/accessibility/focus-trap";
import type { EvolutionView } from "./use-fami-preliminary";
import type { Quadrimester } from "@/features/fami/preliminary/domain";

type Props = {
  quadrimester: Quadrimester;
  percentage: number | null;
  deltaPercentagePoints: number | null;
  evolution: EvolutionView | null;
};

function formatDelta(delta: number | null): string | null {
  if (delta == null) return null;
  const prefix = delta >= 0 ? "+" : "";
  return `${prefix}${formatPreliminaryPercentage(delta)}`;
}

export function QuadrimesterEvolutionModal({
  quadrimester,
  percentage,
  deltaPercentagePoints,
  evolution,
}: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const deltaLabel = formatDelta(deltaPercentagePoints);
  const rows = evolution?.rows ?? [];

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (rows.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className={`${formSurface.ghostButton} mt-2 -ml-3 h-9 min-h-9 px-3 text-brand-700 hover:bg-brand-50 hover:text-brand-800`}
        onClick={() => setOpen(true)}
      >
        {famiPreliminaryLabels.viewDetails}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
        >
          <button
            type="button"
            aria-label="Fechar"
            className="absolute inset-0 cursor-default"
            onClick={() => setOpen(false)}
            tabIndex={-1}
          />
          <div
            ref={panelRef}
            className="relative flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            onKeyDown={(event) => trapTabFocus(event, panelRef.current)}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <h2 id={titleId} className={typography.subsectionTitle}>
                  {quadrimester}º quadrimestre
                </h2>
                <p id={descId} className={`mt-1 ${typography.sectionDescription}`}>
                  {famiPreliminaryLabels.panoramaLabel}:{" "}
                  <span className="font-semibold text-slate-900">
                    {formatPreliminaryPercentage(percentage)}
                  </span>
                  {deltaLabel ? (
                    <span className="text-slate-700"> · {deltaLabel}</span>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-md p-1 text-slate-600 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {evolution ? (
                <p className={`${typography.meta} text-slate-600`}>
                  {evolution.criteriaNowScoring}{" "}
                  {evolution.criteriaNowScoring === 1
                    ? "critério passou a pontuar"
                    : "critérios passaram a pontuar"}
                  {" · "}
                  {evolution.recoveredPoints}{" "}
                  {evolution.recoveredPoints === 1 ? "ponto recuperado" : "pontos recuperados"}
                </p>
              ) : null}

              <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100 text-xs font-semibold uppercase text-slate-700">
                    <tr>
                      <th className="px-3 py-2.5">Critério</th>
                      <th className="px-3 py-2.5">Evolução</th>
                      <th className="px-3 py-2.5 text-right">Pontos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {rows.map((row) => (
                      <tr key={row.questionVersionId}>
                        <td className="px-3 py-2.5 font-medium text-slate-900">
                          {row.questionPrompt}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">
                          {criterionEvolutionLabel(row.previousStatus)} →{" "}
                          {criterionEvolutionLabel(row.currentStatus)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                          {row.recoveredPoints}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex shrink-0 justify-end border-t border-slate-200 bg-slate-50 px-5 py-3.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={formSurface.secondaryButtonSm}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
