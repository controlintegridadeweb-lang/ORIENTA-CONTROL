import { PieChart } from "lucide-react";
import { typography } from "@/shared/layout/design-system";

export type DonutSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

function roundSvg(n: number) {
  return Math.round(n * 1e4) / 1e4;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInRadians: number) {
  return {
    x: roundSvg(cx + radius * Math.cos(angleInRadians)),
    y: roundSvg(cy + radius * Math.sin(angleInRadians)),
  };
}

function describeDonutArc(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
) {
  const startOuter = polarToCartesian(cx, cy, outerR, endAngle);
  const endOuter = polarToCartesian(cx, cy, outerR, startAngle);
  const startInner = polarToCartesian(cx, cy, innerR, startAngle);
  const endInner = polarToCartesian(cx, cy, innerR, endAngle);
  const largeArcFlag = endAngle - startAngle <= Math.PI ? 0 : 1;
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArcFlag} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArcFlag} 1 ${endInner.x} ${endInner.y}`,
    "Z",
  ].join(" ");
}

type Props = {
  slices: DonutSlice[];
  centerValue: number | string;
  centerLabel: string;
  ariaLabel: string;
  emptyTitle: string;
  emptyDescription: string;
};

export function DonutChart({
  slices,
  centerValue,
  centerLabel,
  ariaLabel,
  emptyTitle,
  emptyDescription,
}: Props) {
  const entries = slices.filter((slice) => slice.value > 0);
  const total = entries.reduce((sum, slice) => sum + slice.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-full min-h-55 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-5 py-10 text-center">
        <PieChart className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
        <p className="text-base font-medium text-slate-700">{emptyTitle}</p>
        <p className="max-w-sm text-sm leading-relaxed text-slate-500">{emptyDescription}</p>
      </div>
    );
  }

  const size = 240;
  const outerR = size / 2;
  const innerR = outerR * 0.62;
  const cx = outerR;
  const cy = outerR;
  let angle = -Math.PI / 2;
  const isSingleCategory = entries.length === 1;

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-2 sm:flex-row sm:flex-wrap">
      <div className="relative">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-52 w-52 sm:h-56 sm:w-56" role="img" aria-label={ariaLabel}>
          {isSingleCategory ? (
            <>
              <circle cx={cx} cy={cy} r={outerR} fill={entries[0]!.color} />
              <circle cx={cx} cy={cy} r={innerR} fill="white" />
            </>
          ) : (
            entries.map((slice) => {
              const sliceAngle = (slice.value / total) * Math.PI * 2;
              const start = angle;
              const end = angle + sliceAngle;
              const path = describeDonutArc(cx, cy, outerR, innerR, start, end);
              angle = end;
              return <path key={slice.key} d={path} fill={slice.color} />;
            })
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className={typography.metricValue}>{centerValue}</span>
          <span className={`mt-2 ${typography.auxiliary}`}>{centerLabel}</span>
        </div>
      </div>
      <ul className="w-full max-w-md space-y-2.5 text-base sm:flex-1">
        {entries.map((slice) => {
          const pct = ((slice.value / total) * 100).toFixed(0);
          return (
            <li
              key={slice.key}
              className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 hover:bg-slate-50"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: slice.color }}
                  aria-hidden
                />
                <span className="truncate font-medium text-slate-800">{slice.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-600">
                <span className="text-base font-semibold tabular-nums text-slate-900">{slice.value}</span>
                <span className="ml-1.5 text-sm text-slate-500">({pct}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
