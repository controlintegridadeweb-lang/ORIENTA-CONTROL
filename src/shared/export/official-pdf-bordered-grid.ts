import { drawRoundedRect, drawVariableRoundedRect } from "@/shared/export/pdf-rounded-rect";
import { latinPdfSafe } from "@/shared/export/text";
import type { Cursor, PdfGridHost, ReportFonts } from "@/shared/export/official-pdf-types";
import { contentWidth, reportTheme } from "@/shared/export/official-pdf-theme";

const PAD = 10;
const LINE = 12;
const MIN_H = 32;
const SIZE = 8;
const ASCENT = 6;
const GRID_RADIUS = 0;
const BORDER = 0.75;

export type GridCell = {
  text: string;
  width: number;
  bold?: boolean;
};

function wrapParagraph(
  font: ReportFonts["regular"],
  text: string,
  size: number,
  maxWidth: number,
): string[] {
  const safe = latinPdfSafe(text).replace(/\s+/g, " ").trim();
  if (!safe) return [""];
  const words = safe.split(" ");
  const lines: string[] = [];
  let current = "";

  const flush = () => {
    if (current) lines.push(current);
    current = "";
  };

  const splitLong = (word: string) => {
    let rest = word;
    while (rest.length > 0) {
      let cut = rest.length;
      while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) {
        cut -= 1;
      }
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
  };

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    flush();
    if (font.widthOfTextAtSize(word, size) <= maxWidth) current = word;
    else splitLong(word);
  }
  flush();
  return lines.length > 0 ? lines : [""];
}

function wrapLines(
  font: ReportFonts["regular"],
  text: string,
  size: number,
  maxWidth: number,
): string[] {
  const paragraphs = latinPdfSafe(text).split(/\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    lines.push(...wrapParagraph(font, paragraph, size, maxWidth));
  }
  return lines.length > 0 ? lines : [""];
}

function rowHeight(doc: PdfGridHost, cells: GridCell[]): number {
  let lines = 1;
  for (const cell of cells) {
    const font = cell.bold ? doc.fonts.bold : doc.fonts.regular;
    const wrapped = wrapLines(font, cell.text, SIZE, Math.max(12, cell.width - PAD * 2));
    lines = Math.max(lines, wrapped.length);
  }
  return Math.max(MIN_H, lines * LINE + PAD * 2);
}

function drawCellText(
  doc: PdfGridHost,
  page: Cursor["page"],
  cell: GridCell,
  x: number,
  top: number,
  height: number,
): void {
  const font = cell.bold ? doc.fonts.bold : doc.fonts.regular;
  const maxW = Math.max(12, cell.width - PAD * 2);
  const lines = wrapLines(font, cell.text, SIZE, maxW);
  const blockH = (lines.length - 1) * LINE + ASCENT;
  let y = top - (height - blockH) / 2 - ASCENT;
  for (const line of lines) {
    const lineW = font.widthOfTextAtSize(line, SIZE);
    page.drawText(line, {
      x: x + (cell.width - lineW) / 2,
      y,
      size: SIZE,
      font,
      color: reportTheme.slate900,
      maxWidth: maxW,
    });
    y -= LINE;
  }
}

function drawCellBackground(
  page: Cursor["page"],
  x: number,
  bottom: number,
  width: number,
  height: number,
  color: typeof reportTheme.white,
  radii: { tl: number; tr: number; br: number; bl: number },
): void {
  const hasRadius = radii.tl + radii.tr + radii.br + radii.bl > 0;
  if (!hasRadius) {
    page.drawRectangle({ x, y: bottom, width, height, color, borderWidth: 0 });
    return;
  }
  drawVariableRoundedRect(page, {
    x,
    y: bottom,
    width,
    height,
    radii,
    color,
  });
}

function drawGridLine(
  page: Cursor["page"],
  start: { x: number; y: number },
  end: { x: number; y: number },
): void {
  page.drawLine({
    start,
    end,
    thickness: BORDER,
    color: reportTheme.gridInk,
  });
}

/** Bloco de grade com borda externa retangular e linhas internas. */
export function drawGridBlock(
  doc: PdfGridHost,
  cursor: Cursor,
  rows: GridCell[][],
): Cursor {
  if (rows.length === 0) return cursor;

  const heights = rows.map((cells) => rowHeight(doc, cells));
  const totalH = heights.reduce((sum, height) => sum + height, 0);
  const w = contentWidth();
  const x0 = reportTheme.margin;

  const cur = doc.ensureSpace(cursor, totalH + 14);
  const blockTop = cur.y;
  const blockBottom = blockTop - totalH;

  const rowBounds: Array<{ top: number; bottom: number; cells: GridCell[] }> = [];
  let yTop = blockTop;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const cells = rows[rowIndex]!;
    const height = heights[rowIndex]!;
    const bottom = yTop - height;
    rowBounds.push({ top: yTop, bottom, cells });

    let x = x0;
    for (const cell of cells) {
      const bg = cell.bold ? reportTheme.gridLabelBg : reportTheme.white;
      drawCellBackground(cur.page, x, bottom, cell.width, height, bg, {
        tl: 0,
        tr: 0,
        bl: 0,
        br: 0,
      });
      drawCellText(doc, cur.page, cell, x, yTop, height);
      x += cell.width;
    }

    yTop = bottom;
  }

  for (let rowIndex = 0; rowIndex < rowBounds.length; rowIndex += 1) {
    const { top, bottom, cells } = rowBounds[rowIndex]!;

    if (rowIndex < rowBounds.length - 1) {
      drawGridLine(
        cur.page,
        { x: x0, y: bottom },
        { x: x0 + w, y: bottom },
      );
    }

    let x = x0;
    for (let colIndex = 0; colIndex < cells.length - 1; colIndex += 1) {
      x += cells[colIndex]!.width;
      drawGridLine(
        cur.page,
        { x, y: bottom },
        { x, y: top },
      );
    }
  }

  drawRoundedRect(cur.page, {
    x: x0,
    y: blockBottom,
    width: w,
    height: totalH,
    radius: GRID_RADIUS,
    borderColor: reportTheme.gridInk,
    borderWidth: BORDER,
  });

  return { ...cur, y: blockBottom - 12 };
}

/** Quebra grades longas em blocos que cabem acima da área reservada ao rodapé. */
export function drawGridBlockPaginated(
  doc: PdfGridHost,
  cursor: Cursor,
  rows: GridCell[][],
): Cursor {
  if (rows.length === 0) return cursor;

  const heights = rows.map((cells) => rowHeight(doc, cells));
  let cur = cursor;
  let index = 0;

  while (index < rows.length) {
    let batchHeight = 0;
    let batchEnd = index;

    while (batchEnd < rows.length) {
      const nextHeight = heights[batchEnd]!;
      const totalIfAdded = batchHeight + nextHeight;
      const available = cur.y - doc.contentBottom - 14;

      if (batchEnd > index && totalIfAdded > available) break;

      batchHeight = totalIfAdded;
      batchEnd += 1;
    }

    cur = drawGridBlock(doc, cur, rows.slice(index, batchEnd));
    index = batchEnd;
  }

  return cur;
}

/** Linha de grade com borda preta e texto centralizado (modelo de referência). */
export function drawGridRow(
  doc: PdfGridHost,
  cursor: Cursor,
  cells: GridCell[],
): Cursor {
  return drawGridBlock(doc, cursor, [cells]);
}

export function headerRowCells(title: string): GridCell[] {
  return [{ text: title, width: contentWidth(), bold: true }];
}

export function labelValueRowCells(label: string, value: string): GridCell[] {
  const w = contentWidth();
  const labelW = w * 0.25;
  return [
    { text: label, width: labelW, bold: true },
    { text: value, width: w - labelW },
  ];
}

export function quadRowCells(a: string, b: string, c: string, d: string): GridCell[] {
  const q = contentWidth() / 4;
  return [
    { text: a, width: q, bold: true },
    { text: b, width: q },
    { text: c, width: q, bold: true },
    { text: d, width: q },
  ];
}

export function labelValueRow(
  doc: PdfGridHost,
  cursor: Cursor,
  label: string,
  value: string,
): Cursor {
  return drawGridRow(doc, cursor, labelValueRowCells(label, value));
}

export function quadRow(
  doc: PdfGridHost,
  cursor: Cursor,
  a: string,
  b: string,
  c: string,
  d: string,
): Cursor {
  return drawGridRow(doc, cursor, quadRowCells(a, b, c, d));
}

export function headerRow(doc: PdfGridHost, cursor: Cursor, title: string): Cursor {
  return drawGridRow(doc, cursor, headerRowCells(title));
}
