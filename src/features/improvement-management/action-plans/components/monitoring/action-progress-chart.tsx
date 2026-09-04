import { BarChart3 } from "lucide-react";
import type { MonitoringActionBar } from "./monitoring-chart-model";

type Props = {
  bars: MonitoringActionBar[];
};

export function ActionProgressChart({ bars }: Props) {
  if (bars.length === 0) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-5 py-8 text-center">
        <BarChart3 className="h-8 w-8 text-slate-300" aria-hidden />
        <p className="text-base font-medium text-slate-700">Nenhuma ação para plotar</p>
        <p className="max-w-sm text-sm leading-relaxed text-slate-500">
          O progresso por ação aparece quando houver ações cadastradas.
        </p>
      </div>
    );
  }

  const height = Math.max(160, 36 + bars.length * 36);
  const width = 480;
  const padding = { top: 8, right: 56, bottom: 8, left: 48 };
  const innerWidth = width - padding.left - padding.right;
  const rowHeight = (height - padding.top - padding.bottom) / bars.length;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Progresso por ação"
      className="h-auto w-full"
    >
      {bars.map((bar, index) => {
        const progress = Math.max(0, Math.min(100, bar.progress));
        const y = padding.top + index * rowHeight;
        const barY = y + 8;
        const barHeight = Math.max(12, rowHeight - 16);
        const barWidth = Math.max(progress === 0 ? 0 : 4, (progress / 100) * innerWidth);
        return (
          <g key={bar.id}>
            <title>{`${bar.label}: ${bar.title} · ${progress}%`}</title>
            <text
              x={padding.left - 10}
              y={barY + barHeight / 2 + 4}
              textAnchor="end"
              fontSize="12"
              fontWeight="600"
              fill="#475569"
            >
              {bar.label}
            </text>
            <rect
              x={padding.left}
              y={barY}
              width={innerWidth}
              height={barHeight}
              fill="#f1f5f9"
              rx="6"
            />
            {barWidth > 0 ? (
              <rect
                x={padding.left}
                y={barY}
                width={barWidth}
                height={barHeight}
                fill={bar.color}
                rx="6"
              />
            ) : null}
            <text
              x={padding.left + innerWidth + 8}
              y={barY + barHeight / 2 + 4}
              fontSize="12"
              fontWeight="700"
              fill="#0f172a"
            >
              {progress}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
