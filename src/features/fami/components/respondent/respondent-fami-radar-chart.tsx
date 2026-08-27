"use client";

import { useId } from "react";
import type { AxisMaturity } from "@/features/fami/types";
import {
  colorForAxisNameOrFallback,
  sortAxesMaturity,
} from "@/features/fami/fami-axis-display";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";

type Props = {
  axes: AxisMaturity[];
  title?: string;
  /** Sem borda dupla quando dentro de painel analítico. */
  embedded?: boolean;
};

const SIZE = 360;
const CENTER = SIZE / 2;
/** Raio até os vértices (eixos). Margem para nome + % fora do polígono. */
const RADIUS = SIZE / 2 - 72;
const RINGS = [25, 50, 75, 100] as const;

const GRID_STROKE = "#e2e8f0";
const AXIS_STROKE = "#cbd5e1";
const VALUE_POLYGON_STROKE = "#64748b";
const VALUE_POLYGON_FILL = "rgba(100, 116, 139, 0.14)";
const VALUE_POLYGON_STROKE_WIDTH = 1.75;

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

function ringPoints(n: number, value: number): string {
  return Array.from({ length: n }, (_, i) => {
    const p = pointFor(i, n, value);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ");
}

/**
 * Radar SVG dos eixos do FAMI. Mostra a maturidade em escala 0-100,
 * com anéis de referência em 25/50/75/100%.
 *
 * Uma única série (polígono) representa os percentuais; cores por eixo
 * aparecem em rótulos, percentuais, marcadores e legenda.
 */
export function RespondentFamiRadarChart({ axes, title, embedded = false }: Props) {
  const reactId = useId().replace(/:/g, "");
  const washId = `fami-radar-wash-${reactId}`;
  const glowId = `fami-radar-dot-glow-${reactId}`;
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
          ? "flex h-full min-h-80 flex-col justify-center gap-5 p-1 sm:p-2"
          : `space-y-5 p-5 ${formSurface.card}`
      }
    >
      {title ? (
        <figcaption className={typography.subsectionTitle}>{title}</figcaption>
      ) : null}

      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Radar de maturidade por eixo"
        className="mx-auto h-auto w-full max-w-md"
      >
        <defs>
          <radialGradient id={washId} cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#f8fafc" stopOpacity="1" />
            <stop offset="100%" stopColor="#f1f5f9" stopOpacity="0" />
          </radialGradient>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.6" floodColor="#64748b" floodOpacity="0.25" />
          </filter>
        </defs>

        <circle cx={CENTER} cy={CENTER} r={RADIUS + 8} fill={`url(#${washId})`} />

        {[100, 75, 50, 25].map((r, index) => (
          <polygon
            key={`fill-${r}`}
            points={ringPoints(n, r)}
            fill={index % 2 === 0 ? "rgba(148, 163, 184, 0.06)" : "rgba(255,255,255,0.55)"}
            stroke="none"
          />
        ))}

        {RINGS.map((r) => (
          <polygon
            key={r}
            points={ringPoints(n, r)}
            fill="none"
            stroke={GRID_STROKE}
            strokeWidth={r === 100 ? 1.25 : 1}
            strokeDasharray={r === 100 ? undefined : "3.5 3.5"}
          />
        ))}

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
              strokeWidth={1}
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
            <g key={`pt-${axis.axisName}-${i}`} filter={`url(#${glowId})`}>
              <circle cx={p.x} cy={p.y} r={value <= 0 ? 4 : 5.5} fill={color} opacity={0.18} />
              <circle
                cx={p.x}
                cy={p.y}
                r={value <= 0 ? 2.75 : 4}
                fill={color}
                stroke="#fff"
                strokeWidth={1.75}
              />
            </g>
          );
        })}

        {ordered.map((axis, i) => {
          const labelPos = pointFor(i, n, 128);
          const color = colorForAxisNameOrFallback(axis.axisName);
          const value = Math.max(0, Math.min(100, axis.percentage));
          const anchor =
            labelPos.x < CENTER - 8 ? "end" : labelPos.x > CENTER + 8 ? "start" : "middle";
          const isTop = Math.abs(labelPos.x - CENTER) <= 8 && labelPos.y < CENTER;
          const nameY = isTop ? labelPos.y - 2 : labelPos.y;
          const pctY = nameY + 14;
          return (
            <g key={`lbl-${axis.axisName}-${i}`}>
              <text
                x={labelPos.x}
                y={nameY}
                textAnchor={anchor}
                fontSize="12"
                fill={color}
                fontWeight={600}
              >
                {axis.axisName}
              </text>
              <text
                x={labelPos.x}
                y={pctY}
                textAnchor={anchor}
                fontSize="11"
                fill="#64748b"
                fontWeight={500}
              >
                {Math.round(value)}%
              </text>
            </g>
          );
        })}

        {RINGS.map((r) => {
          const dist = (r / 100) * RADIUS;
          const x = roundSvg(CENTER + dist * Math.cos(scaleAngle));
          const y = roundSvg(CENTER + dist * Math.sin(scaleAngle));
          const offset = 14;
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

      <ul className="mx-auto flex w-full max-w-md flex-wrap items-center justify-center gap-2">
        {ordered.map((axis) => {
          const color = colorForAxisNameOrFallback(axis.axisName);
          const value = Math.max(0, Math.min(100, axis.percentage));
          return (
            <li
              key={`legend-${axis.axisName}`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <span className="font-medium text-slate-800">{axis.axisName}</span>
              <span className="tabular-nums text-slate-500">{Math.round(value)}%</span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
