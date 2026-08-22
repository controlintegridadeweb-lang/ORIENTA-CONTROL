import { BarChart3 } from "lucide-react";
import {
  AXIS_THEME_FALLBACK_PRIMARY,
  getAxisThemeStrict,
} from "@/shared/theme/axis-theme";

function colorForAxisNameOrFallback(axisName: string): string {
  return getAxisThemeStrict(axisName)?.primary ?? AXIS_THEME_FALLBACK_PRIMARY;
}

const DENSITY = {
  default: {
    width: 480,
    height: 280,
    padding: { top: 24, right: 24, bottom: 44, left: 46 },
    barGap: 28,
    valueFontSize: 14,
    labelFontSize: 13,
  },
  /** Dashboard e cards com poucas barras — menos altura vazia. */
  compact: {
    width: 480,
    height: 220,
    padding: { top: 18, right: 20, bottom: 36, left: 42 },
    barGap: 22,
    valueFontSize: 13,
    labelFontSize: 12,
  },
} as const;

export type AxisBarDatum = {
  axisId?: string | null;
  axisName: string;
  percentage: number;
  maturityLevel: number | null;
};

type Props = {
  data: AxisBarDatum[];
  density?: keyof typeof DENSITY;
};

export function AxisBarChart({ data, density = "default" }: Props) {
  const applicable = data.filter((axis) => axis.maturityLevel != null);
  const notApplicable = data.filter((axis) => axis.maturityLevel == null);
  const layout = DENSITY[density];

  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-5 py-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
        <p className="text-base font-medium text-slate-700">Sem dados FAMI ainda</p>
        <p className="max-w-sm text-sm leading-relaxed text-slate-500">
          Os eixos aparecem após o próximo processamento.
        </p>
      </div>
    );
  }

  if (applicable.length === 0) {
    return (
      <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-5 py-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
        <p className="text-base font-medium text-slate-700">Resultado não aplicável</p>
        <p className="max-w-md text-sm leading-relaxed text-slate-500">
          Nenhum eixo possui critérios aplicáveis ao FAMI neste diagnóstico. N/A não representa
          pontuação zero.
        </p>
      </div>
    );
  }

  const { width, height, padding, barGap, valueFontSize, labelFontSize } = layout;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const barWidth =
    (innerWidth - barGap * Math.max(0, applicable.length - 1)) / applicable.length;
  const ticks = [0, 25, 50, 75, 100];

  return (
    <div className="flex h-full flex-col justify-center space-y-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Maturidade por eixo aplicável"
        className="h-full w-full"
      >
        {ticks.map((tick) => {
          const y = padding.top + innerHeight - (tick / 100) * innerHeight;
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={padding.left + innerWidth}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="#64748b"
                fontWeight="500"
              >
                {tick}%
              </text>
            </g>
          );
        })}

        {applicable.map((item, index) => {
          const percentage = Math.max(0, Math.min(100, item.percentage));
          const barHeight = Math.max(2, (percentage / 100) * innerHeight);
          const x = padding.left + index * (barWidth + barGap);
          const y = padding.top + innerHeight - barHeight;
          const color = colorForAxisNameOrFallback(item.axisName);
          return (
            <g key={(item.axisId ?? item.axisName) + item.axisName}>
              <rect
                x={x}
                y={padding.top}
                width={barWidth}
                height={innerHeight}
                fill={color}
                opacity={0.06}
                rx={4}
              />
              <rect x={x} y={y} width={barWidth} height={barHeight} fill={color} rx={4} />
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize={valueFontSize}
                fontWeight="700"
                fill="#0f172a"
              >
                {percentage.toFixed(0)}%
              </text>
              <text
                x={x + barWidth / 2}
                y={padding.top + innerHeight + 18}
                textAnchor="middle"
                fontSize={labelFontSize}
                fontWeight="500"
                fill="#475569"
              >
                {item.axisName}
              </text>
            </g>
          );
        })}
      </svg>
      {notApplicable.length > 0 ? (
        <p className="text-center text-xs text-slate-500">
          Fora do gráfico por não aplicabilidade:{" "}
          {notApplicable.map((axis) => axis.axisName).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}
