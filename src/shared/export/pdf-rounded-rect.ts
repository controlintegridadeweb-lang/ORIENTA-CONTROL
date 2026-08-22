import type { PDFPage, RGB } from "pdf-lib";

/**
 * Path SVG com origem no canto superior esquerdo e Y crescente para baixo.
 * O pdf-lib aplica `scale(1, -1)` em `drawSvgPath`.
 */
export function roundedRectPath(width: number, height: number, radius: number): string {
  const r = Math.min(Math.max(0, radius), width / 2, height / 2);
  if (r === 0) {
    return `M 0 0 H ${width} V ${height} H 0 Z`;
  }
  return [
    `M ${r} 0`,
    `H ${width - r}`,
    `Q ${width} 0 ${width} ${r}`,
    `V ${height - r}`,
    `Q ${width} ${height} ${width - r} ${height}`,
    `H ${r}`,
    `Q 0 ${height} 0 ${height - r}`,
    `V ${r}`,
    `Q 0 0 ${r} 0`,
    "Z",
  ].join(" ");
}

export function drawRoundedRect(
  page: PDFPage,
  options: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    color?: RGB;
    borderColor?: RGB;
    borderWidth?: number;
  },
): void {
  page.drawSvgPath(roundedRectPath(options.width, options.height, options.radius), {
    x: options.x,
    y: options.y + options.height,
    color: options.color,
    borderColor: options.borderColor,
    borderWidth: options.borderWidth,
  });
}
