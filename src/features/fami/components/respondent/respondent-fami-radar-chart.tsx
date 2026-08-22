"use client";

import type { AxisMaturity } from "@/features/fami/types";
import {
  colorForAxisNameOrFallback,
  sortAxesMaturity,
} from "@/features/fami/fami-axis-display";
import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  axes: AxisMaturity[];
  title?: string;
  /** Sem borda dupla quando dentro de painel analítico. */
  embedded?: boolean;
};

const SIZE = 340;
const CENTER = SIZE / 2;
/** Raio até os vértices (eixos). Margem para nome + % fora do polígono. */
const RADIUS = SIZE / 2 - 64;
const RINGS = [25, 50, 75, 100] as const;

/** Grade e raios de referência — sempre neutros. */
const GRID_STROKE = "#e2e8f0";
const AXIS_STROKE = "#cbd5e1";
/**
 * Única série de resultados: contorno neutro e fino + preenchimento suave,
 * para não competir com as cores dos eixos nos marcadores.
 */
const VALUE_POLYGON_STROKE = "#94a3b8";
const VALUE_POLYGON_FILL = "rgba(100, 116, 139, 0.08)";
const VALUE_POLYGON_STROKE_WIDTH = 1.25;

/** Estabiliza coordenadas entre SSR e cliente (engines JS diferem em float). */
function roundSvg(n: number) {
  return Math.round(n * 1e4) / 1e4;
}

function pointFor(i: number, total: number, value: number): { x: number; y: number } {
  const angle = (Math.PI * 2 * i) / total - Math.PI / 2;
  const r = (value / 100) * RADIUS;
  return {
    x: roundSvg(CENTER + r * Math.cos(angle)),
    y: roundSvg(CENTER + r * Math.sin(angle)),
  };
}

/**
 * Radar SVG dos eixos do FAMI. Mostra a maturidade em escala 0-100,
 * com anéis de referência em 25/50/75/100%.
 *
 * Uma única série (polígono) representa os percentuais; cores por eixo
 * aparecem só em rótulos, percentuais e marcadores.
 */
export function RespondentFamiRadarChart({ axes, title, embedded = false }: Props) {
  const ordered = sortAxesMaturity(axes).filter((axis) => axis.maturityLevel != null);

  if (ordered.length < 3) {
    return (
      <div className={formSurface.empty.container}>
        <p className={formSurface.empty.description}>
          São necessários ao menos 3 eixos aplicáveis para gerar o radar de maturidade. Eixos N/A ficam fora da comparação.
        </p>
      </div>
    );
  }

  const n = ordered.length;
  /** Eixo inferior-direito: livre para escala, sem competir com o rótulo do topo. */
  const scaleAxisIndex = 1;
  const scaleAngle = (Math.PI * 2 * scaleAxisIndex) / n - Math.PI / 2;

  const polygon = ordered
    .map((axis, i) => {
      const p = pointFor(i, n, Math.max(0, Math.min(100, axis.percentage)));
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <figure
      className={
        embedded
          ? "flex h-full min-h-80 flex-col justify-center p-2 sm:p-3"
          : `p-5 ${formSurface.card}`
      }
    >
      {title ? (
        <figcaption className="mb-4 text-micro font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </figcaption>
      ) : null}
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Radar de maturidade por eixo"
        className="mx-auto h-auto w-full max-w-md"
      >
        {RINGS.map((r) => {
          const points = ordered
            .map((_, i) => {
              const p = pointFor(i, n, r);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(" ");
          return (
            <polygon
              key={r}
              points={points}
              fill="none"
              stroke={GRID_STROKE}
              strokeDasharray="3 3"
            />
          );
        })}

        {ordered.map((axis, i) => {
          const p = pointFor(i, n, 100);
          return (
            <line
              key={`axis-${axis.axisName}-${i}`}
              x1={CENTER}
              y1={CENTER}
              x2={p.x}
              y2={p.y}
              stroke={AXIS_STROKE}
            />
          );
        })}

        <polygon
          points={polygon}
          fill={VALUE_POLYGON_FILL}
          stroke={VALUE_POLYGON_STROKE}
          strokeWidth={VALUE_POLYGON_STROKE_WIDTH}
          strokeLinejoin="round"
        />

        {ordered.map((axis, i) => {
          const value = Math.max(0, Math.min(100, axis.percentage));
          const p = pointFor(i, n, value);
          const color = colorForAxisNameOrFallback(axis.axisName);
          return (
            <circle
              key={`pt-${axis.axisName}-${i}`}
              cx={p.x}
              cy={p.y}
              r={value <= 0 ? 2.5 : 3.5}
              fill={color}
              stroke="#fff"
              strokeWidth={1}
            />
          );
        })}

        {ordered.map((axis, i) => {
          const labelPos = pointFor(i, n, 122);
          const color = colorForAxisNameOrFallback(axis.axisName);
          const anchor =
            labelPos.x < CENTER - 8 ? "end" : labelPos.x > CENTER + 8 ? "start" : "middle";
          const isTop = Math.abs(labelPos.x - CENTER) <= 8 && labelPos.y < CENTER;
          return (
            <text
              key={`lbl-${axis.axisName}-${i}`}
              x={labelPos.x}
              y={isTop ? labelPos.y + 4 : labelPos.y + 4}
              textAnchor={anchor}
              fontSize="11"
              fill={color}
              fontWeight={600}
            >
              {axis.axisName}
            </text>
          );
        })}

        {RINGS.map((r) => {
          const dist = (r / 100) * RADIUS;
          const x = roundSvg(CENTER + dist * Math.cos(scaleAngle));
          const y = roundSvg(CENTER + dist * Math.sin(scaleAngle));
          // Desloca perpendicular ao eixo para não cobrir a linha nem o ponto.
          const offset = 12;
          return (
            <text
              key={`ring-${r}`}
              x={roundSvg(x + offset * Math.cos(scaleAngle + Math.PI / 2))}
              y={roundSvg(y + offset * Math.sin(scaleAngle + Math.PI / 2) + 3)}
              fontSize="9"
              fill="#94a3b8"
            >
              {r}%
            </text>
          );
        })}
      </svg>
    </figure>
  );
}
