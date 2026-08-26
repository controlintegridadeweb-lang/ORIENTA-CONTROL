import type { PDFPage, RGB } from "pdf-lib";
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

function polygonPath(
  axes: RadarAxis[],
  value: number,
  cx: number,
  cy: number,
  radius: number,
): string {
  return axes
    .map((_, index) => {
      const p = pointFor(index, axes.length, value, cx, cy, radius);
      return `${index === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    })
    .join(" ")
    .concat(" Z");
}

/**
 * Radar FAMI por eixo (0–100%), no mesmo desenho da UI:
 * grade 25/50/75/100, polígono neutro e marcadores na cor do eixo.
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

  for (const ring of RINGS) {
    page.drawSvgPath(polygonPath(axes, ring, cx, cy, radius), {
      borderColor: grid,
      borderWidth: 0.6,
      borderDashArray: [3, 3],
    });
  }

  for (let i = 0; i < n; i++) {
    const tip = pointFor(i, n, 100, cx, cy, radius);
    page.drawLine({
      start: { x: cx, y: cy },
      end: { x: tip.x, y: tip.y },
      thickness: 0.7,
      color: axisStroke,
    });
  }

  const values = axes.map((axis) => Math.max(0, Math.min(100, axis.percentage)));
  const valuePath = axes
    .map((_, index) => {
      const p = pointFor(index, n, values[index]!, cx, cy, radius);
      return `${index === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    })
    .join(" ")
    .concat(" Z");

  page.drawSvgPath(valuePath, {
    color: reportTheme.slate500,
    opacity: 0.08,
    borderColor: reportTheme.slate500,
    borderWidth: 1.2,
    borderOpacity: 0.7,
  });

  for (let i = 0; i < n; i++) {
    const value = values[i]!;
    const p = pointFor(i, n, value, cx, cy, radius);
    const color: RGB = reportAxisTheme(axes[i]!.axisName).primary;
    page.drawCircle({
      x: p.x,
      y: p.y,
      size: value <= 0 ? 2.2 : 3.2,
      color,
      borderColor: reportTheme.white,
      borderWidth: 0.8,
    });
  }

  for (let i = 0; i < n; i++) {
    const labelPos = pointFor(i, n, 124, cx, cy, radius);
    const label = axes[i]!.axisName;
    const size = 8;
    const color = reportAxisTheme(label).primary;
    const width = doc.fonts.bold.widthOfTextAtSize(label, size);
    let x = labelPos.x;
    if (labelPos.x < cx - 8) x = labelPos.x - width;
    else if (Math.abs(labelPos.x - cx) <= 8) x = labelPos.x - width / 2;
    page.drawText(label, {
      x,
      y: labelPos.y - 3,
      size,
      font: doc.fonts.bold,
      color,
    });
  }
}
