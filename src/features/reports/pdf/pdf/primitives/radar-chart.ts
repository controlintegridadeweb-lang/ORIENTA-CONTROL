import type { PDFPage, RGB } from "pdf-lib";
import { latinPdfSafe } from "@/shared/export/text";
import type { OrientaPdfDocument } from "../document";
import { reportAxisTheme, reportTheme } from "../theme";

const RINGS = [25, 50, 75, 100] as const;

type RadarAxis = {
  axisName: string;
  percentage: number;
};

function pointFor(
  index: number,
  total: number,
  value: number,
  cx: number,
  cy: number,
  radius: number,
): { x: number; y: number } {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const r = (value / 100) * radius;
  return {
    x: cx + r * Math.cos(angle),
    y: cy - r * Math.sin(angle),
  };
}

/**
 * Coordenadas relativas ao centro no sistema SVG do pdf-lib
 * (`drawSvgPath` aplica scale(1, -1) após translate).
 */
function svgRelativePoint(
  index: number,
  total: number,
  value: number,
  radius: number,
): { x: number; y: number } {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const r = (value / 100) * radius;
  return {
    x: r * Math.cos(angle),
    y: r * Math.sin(angle),
  };
}

function svgPolygonPath(
  axes: RadarAxis[],
  value: number,
  radius: number,
): string {
  return axes
    .map((_, index) => {
      const p = svgRelativePoint(index, axes.length, value, radius);
      return `${index === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    })
    .join(" ")
    .concat(" Z");
}

function drawClosedPolyline(
  page: PDFPage,
  points: Array<{ x: number; y: number }>,
  opts: { color: RGB; thickness: number; dash?: number[] },
): void {
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    page.drawLine({
      start: a,
      end: b,
      thickness: opts.thickness,
      color: opts.color,
      dashArray: opts.dash,
    });
  }
}

/**
 * Radar FAMI por eixo (0–100%), alinhado à UI:
 * grade 25/50/75/100, polígono de valores e marcadores na cor do eixo.
 *
 * Polígonos preenchidos usam `drawSvgPath` com origem no centro — coordenadas
 * absolutas de página quebram por causa da inversão de Y do pdf-lib.
 */
export function drawFamiRadarChart(
  doc: OrientaPdfDocument,
  page: PDFPage,
  opts: {
    cx: number;
    cy: number;
    radius: number;
    axes: RadarAxis[];
  },
): void {
  const { cx, cy, radius, axes } = opts;
  const n = axes.length;
  if (n < 3) return;

  const grid = reportTheme.slate200;
  const axisStroke = reportTheme.slate200;
  const ringSoft = reportTheme.slate100;

  for (let i = RINGS.length - 1; i >= 0; i--) {
    const ring = RINGS[i]!;
    const fill =
      i % 2 === 0 ? reportTheme.white : ringSoft;
    page.drawSvgPath(svgPolygonPath(axes, ring, radius), {
      x: cx,
      y: cy,
      color: fill,
      opacity: i % 2 === 0 ? 0.55 : 0.35,
      borderWidth: 0,
    });
  }

  for (const ring of RINGS) {
    const points = axes.map((_, index) =>
      pointFor(index, n, ring, cx, cy, radius),
    );
    drawClosedPolyline(page, points, {
      color: grid,
      thickness: ring === 100 ? 1.1 : 0.75,
      dash: ring === 100 ? undefined : [3.5, 3.5],
    });
  }

  for (let i = 0; i < n; i++) {
    const tip = pointFor(i, n, 100, cx, cy, radius);
    page.drawLine({
      start: { x: cx, y: cy },
      end: { x: tip.x, y: tip.y },
      thickness: 0.9,
      color: axisStroke,
    });
  }

  const values = axes.map((axis) => Math.max(0, Math.min(100, axis.percentage)));
  const valueSvgPath = axes
    .map((_, index) => {
      const p = svgRelativePoint(index, n, values[index]!, radius);
      return `${index === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    })
    .join(" ")
    .concat(" Z");

  page.drawSvgPath(valueSvgPath, {
    x: cx,
    y: cy,
    color: reportTheme.slate500,
    opacity: 0.16,
    borderColor: reportTheme.slate500,
    borderWidth: 1.6,
    borderOpacity: 0.85,
  });

  const scaleAxisIndex = Math.min(1, n - 1);
  for (const ring of RINGS) {
    const tip = pointFor(scaleAxisIndex, n, ring, cx, cy, radius);
    const angle = (Math.PI * 2 * scaleAxisIndex) / n - Math.PI / 2;
    const label = `${ring}%`;
    const size = 7;
    const width = doc.fonts.regular.widthOfTextAtSize(label, size);
    const ox = 11 * Math.cos(angle + Math.PI / 2);
    const oy = -11 * Math.sin(angle + Math.PI / 2);
    page.drawText(label, {
      x: tip.x + ox - width / 2,
      y: tip.y + oy - 2,
      size,
      font: doc.fonts.regular,
      color: reportTheme.slate500,
    });
  }

  for (let i = 0; i < n; i++) {
    const value = values[i]!;
    const p = pointFor(i, n, value, cx, cy, radius);
    const color: RGB = reportAxisTheme(axes[i]!.axisName).primary;
    page.drawCircle({
      x: p.x,
      y: p.y,
      size: value <= 0 ? 3.2 : 4.4,
      color,
      opacity: 0.2,
      borderWidth: 0,
    });
    page.drawCircle({
      x: p.x,
      y: p.y,
      size: value <= 0 ? 2.4 : 3.6,
      color,
      borderColor: reportTheme.white,
      borderWidth: 1.1,
    });
  }

  for (let i = 0; i < n; i++) {
    const labelPos = pointFor(i, n, 128, cx, cy, radius);
    const axisName = axes[i]!.axisName;
    const name = latinPdfSafe(axisName);
    const value = values[i]!;
    const pct = `${Math.round(value)}%`;
    const nameSize = 9;
    const pctSize = 8;
    const color = reportAxisTheme(axisName).primary;
    const nameW = doc.fonts.bold.widthOfTextAtSize(name, nameSize);
    const pctW = doc.fonts.regular.widthOfTextAtSize(pct, pctSize);
    const isTop = Math.abs(labelPos.x - cx) <= 8 && labelPos.y > cy;
    const isLeft = labelPos.x < cx - 8;
    const isRight = labelPos.x > cx + 8;

    let nameX = labelPos.x - nameW / 2;
    if (isLeft) nameX = labelPos.x - nameW;
    else if (isRight) nameX = labelPos.x;

    const nameY = isTop ? labelPos.y + 2 : labelPos.y - 2;
    const pctY = nameY - 12;
    let pctX = labelPos.x - pctW / 2;
    if (isLeft) pctX = labelPos.x - pctW;
    else if (isRight) pctX = labelPos.x;

    page.drawText(name, {
      x: nameX,
      y: nameY,
      size: nameSize,
      font: doc.fonts.bold,
      color,
    });
    page.drawText(pct, {
      x: pctX,
      y: pctY,
      size: pctSize,
      font: doc.fonts.regular,
      color: reportTheme.slate500,
    });
  }
}
