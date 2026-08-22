import type { AnswerValueDistribution } from "@/features/forms/answers-types";

export const ANSWER_CHART_COLORS = {
  yes: "#34D399",
  no: "#FB7185",
  not_applicable: "#FBBF24",
} as const;

const ANSWER_LABELS = {
  yes: "Sim",
  no: "Não",
  not_applicable: "Não se aplica",
} as const;

export type AnswerChartKey = keyof typeof ANSWER_LABELS;

const ANSWER_KEYS: readonly AnswerChartKey[] = ["yes", "no", "not_applicable"];

export type AnswerChartSegment = {
  key: AnswerChartKey;
  label: string;
  value: number;
  color: string;
};

export type AnswerChartLegendItem = AnswerChartSegment & {
  percentage: number;
};

export type AnswerChartModel = {
  total: number;
  /** Segmentos visíveis no gráfico (value > 0). Contagens absolutas, nunca %. */
  chartData: AnswerChartSegment[];
  /** Legenda completa, inclusive zeros. % arredondados só para exibição. */
  legend: AnswerChartLegendItem[];
};

/** Estabiliza coordenadas entre SSR e cliente (engines JS diferem em float). */
function roundSvg(n: number) {
  return Math.round(n * 1e4) / 1e4;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInRadians: number) {
  return {
    x: roundSvg(cx + radius * Math.cos(angleInRadians)),
    y: roundSvg(cy + radius * Math.sin(angleInRadians)),
  };
}

/**
 * Fatia de rosca com um único path.
 * Ordem dos pontos do arco interno: startAngle → endAngle (sentido horário no retorno),
 * alinhada ao padrão já usado em StatusPieChart — a versão anterior invertia startInner/endInner
 * e cruzava a rosca, gerando setores deformados e “círculos” sobrepostos.
 */
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

/** Soma das alternativas — fonte de verdade do total. */
export function sumAnswerDistribution(distribution: AnswerValueDistribution): number {
  return distribution.yes + distribution.no + distribution.not_applicable;
}

/** Percentual de apresentação; o gráfico usa contagens absolutas. */
export function displayPercentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Agrega contagens → total, segmentos do gráfico (sem zeros) e legenda completa.
 * Não altera respostas armazenadas; só transforma para renderização.
 */
export function buildAnswerChartModel(
  distribution: AnswerValueDistribution,
): AnswerChartModel {
  const total = sumAnswerDistribution(distribution);
  const all: AnswerChartSegment[] = ANSWER_KEYS.map((key) => ({
    key,
    label: ANSWER_LABELS[key],
    value: distribution[key],
    color: ANSWER_CHART_COLORS[key],
  }));

  return {
    total,
    chartData: all.filter((item) => item.value > 0),
    legend: all.map((item) => ({
      ...item,
      percentage: displayPercentage(item.value, total),
    })),
  };
}

const VIEW_SIZE = 240;
const OUTER_R = 90;
const INNER_R = 58;
const CX = VIEW_SIZE / 2;
const CY = VIEW_SIZE / 2;

function DonutChart({ segments, total }: { segments: AnswerChartSegment[]; total: number }) {
  if (segments.length === 1) {
    const only = segments[0]!;
    const midR = (OUTER_R + INNER_R) / 2;
    const strokeWidth = OUTER_R - INNER_R;
    return (
      <svg
        viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
        className="h-full w-full"
        role="img"
        aria-label="Distribuição de respostas"
        data-chart-layers="1"
      >
        <circle
          cx={CX}
          cy={CY}
          r={midR}
          fill="none"
          stroke={only.color}
          strokeWidth={strokeWidth}
        />
      </svg>
    );
  }

  const slices = segments.reduce<
    Array<{ segment: AnswerChartSegment; start: number; end: number }>
  >((acc, segment) => {
    const start = acc.length === 0 ? -Math.PI / 2 : acc[acc.length - 1]!.end;
    const end = start + (segment.value / total) * Math.PI * 2;
    acc.push({ segment, start, end });
    return acc;
  }, []);

  return (
    <svg
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
      className="h-full w-full"
      role="img"
      aria-label="Distribuição de respostas"
      data-chart-layers="1"
    >
      {slices.map(({ segment, start, end }) => (
        <path
          key={segment.key}
          d={describeDonutArc(CX, CY, OUTER_R, INNER_R, start, end)}
          fill={segment.color}
          stroke="none"
        />
      ))}
    </svg>
  );
}

function Legend({ items }: { items: AnswerChartLegendItem[] }) {
  return (
    <ul className="w-full space-y-2.5 text-sm" data-testid="answer-chart-legend">
      {items.map((item) => (
        <li key={item.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4">
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: item.color }}
              aria-hidden
              data-legend-color={item.key}
            />
            <span className="truncate font-medium text-slate-700">{item.label}</span>
          </span>
          <span className="tabular-nums font-semibold text-slate-900" data-legend-count={item.key}>
            {item.value}
          </span>
          <span
            className="w-10 text-right tabular-nums text-slate-500"
            data-legend-pct={item.key}
          >
            {item.percentage}%
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Distribuição do único formato de resposta operacional: Sim/Não/Não se aplica. */
export function AnswerDistributionChart({
  distribution,
}: {
  distribution: AnswerValueDistribution;
  /** @deprecated Preferir a soma da distribuição; mantido por compatibilidade de call sites. */
  total?: number;
}) {
  const model = buildAnswerChartModel(distribution);

  if (model.total === 0) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr] md:items-center md:gap-8">
        <div
          className="flex h-60 w-full max-w-60 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 text-center"
          data-testid="answer-chart-empty"
        >
          <p className="text-sm font-medium text-slate-700">Nenhuma resposta registrada</p>
        </div>
        <Legend items={model.legend} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr] md:items-center md:gap-8">
      <div className="relative mx-auto h-60 w-60" data-testid="answer-chart-donut">
        <DonutChart segments={model.chartData} total={model.total} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <strong
            className="text-2xl font-semibold tabular-nums text-slate-900"
            data-testid="answer-chart-total"
          >
            {model.total}
          </strong>
          <span className="text-xs text-slate-500">respostas</span>
        </div>
      </div>
      <Legend items={model.legend} />
    </div>
  );
}
