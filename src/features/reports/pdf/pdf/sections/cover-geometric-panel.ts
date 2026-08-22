import type { PDFPage } from "pdf-lib";
import { reportTheme } from "../theme";

/** Paleta da faixa geométrica lateral (referência editorial Orienta). */
const coverGeoColors = {
  dark: reportTheme.coverGeoDark,
  mid: reportTheme.coverGeoMid,
  light: reportTheme.coverGeoLight,
  accent: reportTheme.coverGeoAccent,
} as const;

const W = reportTheme.page.w;
const H = reportTheme.page.h;

/**
 * Composição geométrica lateral — polígonos sobrepostos com profundidade suave.
 * Ocupa ~32% da largura à direita, altura total da página.
 */
export function drawCoverGeometricPanel(page: PDFPage): void {
  const { dark, mid, light, accent } = coverGeoColors;

  page.drawSvgPath(
    `M ${W} 0 L ${W} ${H} L ${W * 0.52} ${H} L ${W * 0.68} ${H * 0.42} L ${W * 0.58} 0 Z`,
    { color: light },
  );

  page.drawSvgPath(
    `M ${W} 0 L ${W} ${H * 0.72} L ${W * 0.62} ${H * 0.55} L ${W * 0.72} ${H * 0.18} Z`,
    { color: dark },
  );

  page.drawSvgPath(
    `M ${W} ${H * 0.12} L ${W} ${H * 0.88} L ${W * 0.78} ${H * 0.95} L ${W * 0.7} ${H * 0.35} Z`,
    { color: mid, opacity: 0.92 },
  );

  page.drawSvgPath(
    `M ${W * 0.76} ${H * 0.28} L ${W} ${H * 0.38} L ${W} ${H * 0.58} L ${W * 0.68} ${H * 0.48} Z`,
    { color: accent, opacity: 0.55 },
  );

  page.drawSvgPath(
    `M ${W} ${H * 0.55} L ${W} ${H} L ${W * 0.55} ${H} L ${W * 0.64} ${H * 0.68} Z`,
    { color: mid, opacity: 0.78 },
  );
}
