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

export function variableRoundedRectPath(
  width: number,
  height: number,
  radii: { tl: number; tr: number; br: number; bl: number },
): string {
  const tl = Math.min(Math.max(0, radii.tl), width / 2, height / 2);
  const tr = Math.min(Math.max(0, radii.tr), width / 2, height / 2);
  const br = Math.min(Math.max(0, radii.br), width / 2, height / 2);
  const bl = Math.min(Math.max(0, radii.bl), width / 2, height / 2);

  if (tl + tr + br + bl === 0) {
    return `M 0 0 H ${width} V ${height} H 0 Z`;
  }

  return [
    `M ${tl} 0`,
    `H ${width - tr}`,
    tr > 0 ? `Q ${width} 0 ${width} ${tr}` : `L ${width} 0`,
    `V ${height - br}`,
    br > 0 ? `Q ${width} ${height} ${width - br} ${height}` : `L ${width} ${height}`,
    `H ${bl}`,
    bl > 0 ? `Q 0 ${height} 0 ${height - bl}` : `L 0 ${height}`,
    `V ${tl}`,
    tl > 0 ? `Q 0 0 ${tl} 0` : `L 0 0`,
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

export function drawVariableRoundedRect(
  page: PDFPage,
  options: {
    x: number;
    y: number;
    width: number;
    height: number;
    radii: { tl: number; tr: number; br: number; bl: number };
    color?: RGB;
    borderColor?: RGB;
    borderWidth?: number;
  },
): void {
  page.drawSvgPath(
    variableRoundedRectPath(options.width, options.height, options.radii),
    {
      x: options.x,
      y: options.y + options.height,
      color: options.color,
      borderColor: options.borderColor,
      borderWidth: options.borderWidth,
    },
  );
}

/** Retângulo preenchido com cantos arredondados (card de resumo da seção). */
export function drawRoundedRectFill(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: RGB,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  page.drawRectangle({ x: x + r, y, width: width - r * 2, height, color });
  page.drawRectangle({ x, y: y + r, width, height: height - r * 2, color });
  page.drawCircle({ x: x + r, y: y + r, size: r, color });
  page.drawCircle({ x: x + width - r, y: y + r, size: r, color });
  page.drawCircle({ x: x + r, y: y + height - r, size: r, color });
  page.drawCircle({ x: x + width - r, y: y + height - r, size: r, color });
}
