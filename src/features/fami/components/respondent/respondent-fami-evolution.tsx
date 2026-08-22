"use client";

import { formatPlatformDate } from "@/shared/datetime/platform-date-time";
import { LineChart } from "lucide-react";
import type { FamiEvolutionPoint, FamiEvolutionYearPoint } from "@/features/fami/queries";
import { formSurface } from "@/shared/layout/form-surface";
import { FamiEvolutionLegend } from "@/features/fami/components/admin/fami-evolution-legend";
import { splitApplicableEvolutionSegments } from "@/features/fami/evolution-segments";
import { colorForAxisNameOrFallback } from "@/features/fami/fami-axis-display";

type Props =
  | { granularity: "versions"; points: FamiEvolutionPoint[] }
  | { granularity: "years"; points: FamiEvolutionYearPoint[] };

type NormalizedEvolutionPt = {
  sortKey: number;
  subtitle: string;
  xTick: string;
  globalPercentage: number | null;
  axisPercentages: Record<string, number | null>;
  createdAt: string;
};

function normalizePts(props: Props): NormalizedEvolutionPt[] {
  if (props.granularity === "versions") {
    return [...props.points]
      .sort((a, b) => a.processingVersion - b.processingVersion)
      .map((p) => ({
        sortKey: p.processingVersion,
        subtitle: `Processamento nº ${p.processingVersion}`,
        xTick: `P${p.processingVersion}`,
        globalPercentage: p.globalPercentage,
        axisPercentages: p.axisPercentages,
        createdAt: p.createdAt,
      }));
  }
  return [...props.points]
    .sort((a, b) => a.year - b.year)
    .map((p) => ({
      sortKey: p.year,
      subtitle: `${p.year}`,
      xTick: String(p.year),
      globalPercentage: p.globalPercentage,
      axisPercentages: p.axisPercentages,
      createdAt: p.createdAt,
    }));
}

function formatDateTime(iso: string): string {
  return formatPlatformDate(iso, { day: "2-digit", month: "short", year: "numeric" }, iso);
}

export function RespondentFamiEvolution(props: Props) {
  const granularity = props.granularity;
  const sorted = normalizePts(props);

  if (sorted.length === 0) {
    return (
      <section className={formSurface.empty.container}>
        <LineChart className="h-6 w-6 text-slate-400" aria-hidden />
        <p className={formSurface.empty.title}>Sem histórico de processamentos.</p>
        <p className={formSurface.empty.description}>
          {granularity === "years"
            ? "A comparação entre anos aparece após resultados registrados em exercícios distintos, considerando o horário oficial da plataforma — Fortaleza, UTC−3."
            : "Conforme novas versões forem processadas, sua evolução de maturidade aparecerá aqui."}
        </p>
      </section>
    );
  }

  if (sorted.length === 1) {
    const pt = sorted[0]!;
    return (
      <section className={`p-5 ${formSurface.card}`}>
        <p className="text-sm font-semibold text-slate-900">
          {granularity === "years" ? "Primeiro ano com resultado concluído" : "Primeiro processamento registrado"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {granularity === "years" ? `Ano ${pt.subtitle}` : pt.subtitle} ·{" "}
          {formatDateTime(pt.createdAt)} ·{" "}
          {pt.globalPercentage != null ? `${pt.globalPercentage.toFixed(1)}%` : "N/A"}
        </p>
        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
          {granularity === "years"
            ? "Compare anos após processamentos registrados em exercícios distintos."
            : "A evolução comparativa aparece após pelo menos dois processamentos."}
        </p>
      </section>
    );
  }

  const axisNames = Array.from(
    sorted.reduce((set, point) => {
      for (const [axisName, percentage] of Object.entries(point.axisPercentages)) {
        if (percentage != null) set.add(axisName);
      }
      return set;
    }, new Set<string>()),
  );

  const width = 720;
  const height = 280;
  const padding = { top: 20, right: 24, bottom: 40, left: 44 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const n = sorted.length;
  const xAt = (i: number) => padding.left + (i / Math.max(1, n - 1)) * innerW;
  const yAt = (v: number) => padding.top + innerH - (v / 100) * innerH;

  function linePath(get: (pt: NormalizedEvolutionPt) => number | null) {
    const parts: string[] = [];
    let segmentStarted = false;
    sorted.forEach((point, index) => {
      const value = get(point);
      if (value == null || Number.isNaN(value)) {
        segmentStarted = false;
        return;
      }
      parts.push(
        `${segmentStarted ? "L" : "M"} ${xAt(index).toFixed(1)} ${yAt(value).toFixed(1)}`,
      );
      segmentStarted = true;
    });
    return parts.join(" ");
  }

  function areaPaths() {
    return splitApplicableEvolutionSegments(
      sorted.map((point) => point.globalPercentage),
    )
      .filter((segment) => segment.length > 1)
      .map((segment) => {
        const line = segment.map(
          ({ index, value }, itemIndex) =>
            `${itemIndex === 0 ? "M" : "L"} ${xAt(index).toFixed(1)} ${yAt(value).toFixed(1)}`,
        );
        const first = segment[0]!;
        const last = segment[segment.length - 1]!;
        return [
          ...line,
          `L ${xAt(last.index).toFixed(1)} ${yAt(0).toFixed(1)}`,
          `L ${xAt(first.index).toFixed(1)} ${yAt(0).toFixed(1)}`,
          "Z",
        ].join(" ");
      });
  }

  const globalPath = linePath((p) => p.globalPercentage);
  const globalAreas = areaPaths();

  const ariaLabel =
    granularity === "years" ? "Evolução FAMI comparando anos" : "Evolução FAMI ao longo das versões";

  const headerSubtitle =
    granularity === "years"
      ? "Consolidação anual no horário oficial da plataforma — Fortaleza, UTC−3: considera a versão mais recente de cada ano civil."
      : "Variação da pontuação geral e de cada eixo entre as versões processadas.";

  return (
    <section className={`space-y-4 p-5 ${formSurface.card}`}>
      <header>
        <p className="text-sm font-semibold text-slate-900">Evolução da maturidade</p>
        <p className="text-xs text-slate-500">{headerSubtitle}</p>
      </header>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={ariaLabel}
          className="h-auto w-full min-w-0 sm:min-w-120"
        >
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line
                x1={padding.left}
                x2={padding.left + innerW}
                y1={yAt(t)}
                y2={yAt(t)}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 8}
                y={yAt(t) + 4}
                textAnchor="end"
                fontSize="10"
                fill="#64748b"
              >
                {t}%
              </text>
            </g>
          ))}

          {globalAreas.map((area, index) => (
            <path
              key={`global-area-${index}`}
              d={area}
              fill="rgba(15, 23, 42, 0.06)"
              stroke="none"
            />
          ))}

          {axisNames.map((name) => {
            const d = linePath((pt) => pt.axisPercentages[name] ?? null);
            if (!d) return null;
            return (
              <path
                key={name}
                d={d}
                fill="none"
                stroke={colorForAxisNameOrFallback(name)}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                opacity={0.85}
              />
            );
          })}

          {globalPath ? (
            <path
              d={globalPath}
              fill="none"
              stroke="#0f172a"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          ) : null}

          {sorted.map((pt, i) => (
            <text
              key={`tick-${pt.sortKey}-${pt.createdAt}`}
              x={xAt(i)}
              y={height - 16}
              textAnchor="middle"
              fontSize="10"
              fill="#475569"
            >
              {pt.xTick}
            </text>
          ))}

          {sorted.map((pt, i) => {
            const value = pt.globalPercentage;
            if (value == null) {
              return (
                <text
                  key={`na-${pt.sortKey}-${pt.createdAt}`}
                  x={xAt(i)}
                  y={yAt(0) - 8}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#94a3b8"
                >
                  N/A
                </text>
              );
            }
            return (
              <circle
                key={`${pt.sortKey}-${pt.createdAt}`}
                cx={xAt(i)}
                cy={yAt(value)}
                r={4}
                fill="#0f172a"
              />
            );
          })}
        </svg>
      </div>

      <FamiEvolutionLegend
        axisNames={axisNames}
        axisColors={axisNames.map(colorForAxisNameOrFallback)}
        className="text-micro"
      />
    </section>
  );
}
