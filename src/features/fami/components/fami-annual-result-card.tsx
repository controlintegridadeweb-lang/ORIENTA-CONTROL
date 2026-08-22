"use client";

import { famiAnnualLabels } from "@/shared/labels/official-labels";
import { formatPreliminaryPercentage } from "@/features/fami/preliminary/panel-presentation";
import { resolveAnnualFamiDisplay } from "@/features/fami/annual-result";

type Props = {
  referenceYear: number;
  percentage: number | null | undefined;
  maturityLevel: number | null | undefined;
  pointsObtained?: number | null | undefined;
  pointsPossible?: number | null | undefined;
  consolidatedAt?: string | null | undefined;
};

export function FamiAnnualResultCard({
  referenceYear,
  percentage,
  maturityLevel,
}: Props) {
  const display = resolveAnnualFamiDisplay({ referenceYear, percentage, maturityLevel });
  const valueLabel = display.published
    ? formatPreliminaryPercentage(display.percentage)
    : famiAnnualLabels.pending;

  return (
    <div className="space-y-2">
      <div
        className="flex items-center gap-4 rounded-2xl border border-white/80 bg-brand px-5 py-3.5 sm:px-6 sm:py-4"
        title={famiAnnualLabels.disclaimer}
      >
        <p className="shrink-0 text-base font-bold tracking-tight text-white sm:text-lg">
          {famiAnnualLabels.title}
        </p>
        <div
          className="ml-auto flex min-h-11 w-[min(100%,28rem)] max-w-[58%] items-center rounded-xl bg-sky-50 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm sm:min-h-12 sm:text-base"
          aria-label={`${famiAnnualLabels.title}: ${valueLabel}`}
        >
          {valueLabel}
        </div>
      </div>
      <p className="px-1 text-xs leading-relaxed text-slate-500">
        {display.published ? famiAnnualLabels.disclaimer : famiAnnualLabels.pendingHint}
      </p>
    </div>
  );
}
