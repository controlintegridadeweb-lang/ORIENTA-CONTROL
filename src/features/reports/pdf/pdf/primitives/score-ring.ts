import type { PDFPage } from "pdf-lib";
import type { OrientaPdfDocument } from "../document";
import { reportTheme } from "../theme";

/**
 * Indicador circular do percentual FAMI (apresentação; não recalcula o resultado).
 */
export function drawFamiScoreRing(
  doc: OrientaPdfDocument,
  page: PDFPage,
  opts: {
    cx: number;
    cy: number;
    radius: number;
    percentage: number | null;
  },
): void {
  const { cx, cy, radius, percentage } = opts;
  const track = reportTheme.slate100;
  const fill = reportTheme.brand;
  const stroke = 10;

  page.drawCircle({
    x: cx,
    y: cy,
    size: radius,
    borderColor: track,
    borderWidth: stroke,
    color: reportTheme.white,
  });

  if (percentage == null) {
    page.drawText("N/A", {
      x: cx - doc.fonts.bold.widthOfTextAtSize("N/A", 16) / 2,
      y: cy - 6,
      size: 16,
      font: doc.fonts.bold,
      color: reportTheme.slate500,
    });
    return;
  }

  const clamped = Math.max(0, Math.min(100, percentage));
  // pdf-lib não oferece arco parcial simples; aproximamos com segmentos.
  const segments = Math.max(1, Math.round((clamped / 100) * 48));
  const start = Math.PI / 2;
  for (let i = 0; i < segments; i++) {
    const a0 = start - (i / 48) * Math.PI * 2;
    const a1 = start - ((i + 1) / 48) * Math.PI * 2;
    const x0 = cx + Math.cos(a0) * radius;
    const y0 = cy + Math.sin(a0) * radius;
    const x1 = cx + Math.cos(a1) * radius;
    const y1 = cy + Math.sin(a1) * radius;
    page.drawLine({
      start: { x: x0, y: y0 },
      end: { x: x1, y: y1 },
      thickness: stroke,
      color: fill,
    });
  }

  const label = `${clamped.toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  })}%`;
  page.drawText(label, {
    x: cx - doc.fonts.bold.widthOfTextAtSize(label, 18) / 2,
    y: cy - 6,
    size: 18,
    font: doc.fonts.bold,
    color: reportTheme.brandDark,
  });
}
