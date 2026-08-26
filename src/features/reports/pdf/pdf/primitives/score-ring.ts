import { LineCapStyle, type PDFPage } from "pdf-lib";
import type { OrientaPdfDocument } from "../document";
import { reportTheme } from "../theme";

function formatRingPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded.toFixed(0)}%` : `${rounded.toFixed(1)}%`;
}

export const FAMI_SCORE_RING_STROKE = 9;

/**
 * Indicador circular do percentual FAMI (apresentação; não recalcula o resultado).
 * Anel de trilha cinza + arco verde, percentual preto no centro — como na UI.
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
  const stroke = FAMI_SCORE_RING_STROKE;

  page.drawCircle({
    x: cx,
    y: cy,
    size: radius,
    borderColor: reportTheme.scoreRingTrack,
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
  const total = 96;
  const segments = Math.round((clamped / 100) * total);
  const start = Math.PI / 2;

  for (let i = 0; i < segments; i++) {
    const a0 = start - (i / total) * Math.PI * 2;
    const a1 = start - ((i + 1) / total) * Math.PI * 2;
    page.drawLine({
      start: {
        x: cx + Math.cos(a0) * radius,
        y: cy + Math.sin(a0) * radius,
      },
      end: {
        x: cx + Math.cos(a1) * radius,
        y: cy + Math.sin(a1) * radius,
      },
      thickness: stroke,
      color: reportTheme.scoreRing,
      lineCap: LineCapStyle.Round,
    });
  }

  const label = formatRingPercent(clamped);
  const labelSize = 20;
  page.drawText(label, {
    x: cx - doc.fonts.bold.widthOfTextAtSize(label, labelSize) / 2,
    y: cy - 7,
    size: labelSize,
    font: doc.fonts.bold,
    color: reportTheme.slate900,
  });
}
