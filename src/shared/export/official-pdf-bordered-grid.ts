import type { RGB } from "pdf-lib";
import { drawRoundedRect, drawVariableRoundedRect } from "@/shared/export/pdf-rounded-rect";
import { latinPdfSafe } from "@/shared/export/text";
import type { Cursor, PdfGridHost, ReportFonts } from "@/shared/export/official-pdf-types";
import { contentWidth, reportAxisTheme, reportTheme } from "@/shared/export/official-pdf-theme";

const GRID_RADIUS = 6;
const OUTER_BORDER = 0.9;
const INNER_BORDER = 0.45;
const PAD_X = 10;
const PAD_Y = 6;
const MIN_H = 24;
const LINE = 12;
const GRID_PAGE_PAD = 14;

export type GridCellTone = "header" | "subheader" | "label" | "value" | "notice";
export type GridCellAlign = "left" | "center";

export type GridPalette = {
  headerBg: RGB;
  headerFg: RGB;
  subheaderBg: RGB;
  subheaderFg: RGB;
  labelBg: RGB;
  border: RGB;
  line: RGB;
};

export type GridDrawOptions = {
  spans?: readonly number[];
  palette?: GridPalette;
};

export type GridCell = {
  text: string;
  width: number;
  bold?: boolean;
  tone?: GridCellTone;
  align?: GridCellAlign;
};

export function defaultGridPalette(): GridPalette {
  return {
    headerBg: reportTheme.tableHeader,
    headerFg: reportTheme.white,
    subheaderBg: reportTheme.gridSubheaderBg,
    subheaderFg: reportTheme.brandDark,
    labelBg: reportTheme.gridLabelBg,
    border: reportTheme.gridInk,
    line: reportTheme.gridLine,
  };
}

/** Paleta da grade institucional a partir da identidade visual do eixo. */
export function gridPaletteForAxis(axisName: string): GridPalette {
  const axis = reportAxisTheme(axisName);
  return {
    headerBg: axis.strong,
    headerFg: reportTheme.white,
    subheaderBg: axis.tint,
    subheaderFg: axis.strong,
    labelBg: axis.softBackground,
    border: axis.border,
    line: axis.tint,
  };
}

type CellStyle = {
  bg: RGB;
  color: RGB;
  size: number;
  line: number;
  bold: boolean;
  italic: boolean;
  align: GridCellAlign;
  minH: number;
  padX: number;
  padY: number;
};

function resolveTone(cell: GridCell): GridCellTone {
  if (cell.tone) return cell.tone;
  return cell.bold ? "label" : "value";
}

function cellStyle(cell: GridCell, palette: GridPalette = defaultGridPalette()): CellStyle {
  const tone = resolveTone(cell);
  const align = cell.align ?? "left";
  const box = { line: LINE, minH: MIN_H, padX: PAD_X, padY: PAD_Y, align };
  switch (tone) {
    case "header":
      return {
        ...box,
        bg: palette.headerBg,
        color: palette.headerFg,
        size: 8,
        bold: true,
        italic: false,
      };
    case "subheader":
      return {
        ...box,
        bg: palette.subheaderBg,
        color: palette.subheaderFg,
        size: 8,
        bold: true,
        italic: false,
      };
    case "label":
      return {
        ...box,
        bg: palette.labelBg,
        color: reportTheme.slate700,
        size: 8,
        bold: true,
        italic: false,
      };
    case "notice":
      return {
        ...box,
        bg: reportTheme.white,
        color: reportTheme.slate600,
        size: 8,
        bold: false,
        italic: true,
      };
    case "value":
    default:
      return {
        ...box,
        bg: reportTheme.white,
        color: reportTheme.slate900,
        size: 8,
        bold: Boolean(cell.bold),
        italic: false,
      };
  }
}

function cellFont(doc: PdfGridHost, style: CellStyle): ReportFonts["regular"] {
  if (style.italic) return doc.fonts.italic;
  if (style.bold) return doc.fonts.bold;
  return doc.fonts.regular;
}

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

function wrappedLines(doc: PdfGridHost, cell: GridCell): string[] {
  const style = cellStyle(cell);
  const font = cellFont(doc, style);
  return wrapLines(font, cell.text, style.size, Math.max(12, cell.width - style.padX * 2));
}

function rowHeight(doc: PdfGridHost, cells: GridCell[]): number {
  let height = 0;
  for (const cell of cells) {
    const style = cellStyle(cell);
    const wrapped = wrappedLines(doc, cell);
    height = Math.max(height, Math.max(style.minH, wrapped.length * style.line + style.padY * 2));
  }
  return height;
}

function drawCellText(
  doc: PdfGridHost,
  page: Cursor["page"],
  cell: GridCell,
  x: number,
  top: number,
  height: number,
  palette: GridPalette,
): void {
  const style = cellStyle(cell, palette);
  const font = cellFont(doc, style);
  const maxW = Math.max(12, cell.width - style.padX * 2);
  const lines = wrapLines(font, cell.text, style.size, maxW);
  const ascent = style.size * 0.72;
  const blockH = (lines.length - 1) * style.line + ascent;
  let y = top - (height - blockH) / 2 - ascent;

  for (const line of lines) {
    const lineW = font.widthOfTextAtSize(line, style.size);
    const textX =
      style.align === "center" ? x + (cell.width - lineW) / 2 : x + style.padX;
    page.drawText(line, {
      x: textX,
      y,
      size: style.size,
      font,
      color: style.color,
      maxWidth: maxW,
    });
    y -= style.line;
  }
}

function cornerRadii(
  rowIndex: number,
  rowCount: number,
  cellIndex: number,
  cellCount: number,
): { tl: number; tr: number; br: number; bl: number } {
  const firstRow = rowIndex === 0;
  const lastRow = rowIndex === rowCount - 1;
  const firstCell = cellIndex === 0;
  const lastCell = cellIndex === cellCount - 1;
  return {
    tl: firstRow && firstCell ? GRID_RADIUS : 0,
    tr: firstRow && lastCell ? GRID_RADIUS : 0,
    br: lastRow && lastCell ? GRID_RADIUS : 0,
    bl: lastRow && firstCell ? GRID_RADIUS : 0,
  };
}

function drawCellBackground(
  page: Cursor["page"],
  x: number,
  bottom: number,
  width: number,
  height: number,
  color: RGB,
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
  color: RGB,
): void {
  page.drawLine({
    start,
    end,
    thickness: INNER_BORDER,
    color,
  });
}

/** Bloco de grade com cantos suaves, cabeçalho em destaque e texto alinhado à leitura. */
export function drawGridBlock(
  doc: PdfGridHost,
  cursor: Cursor,
  rows: GridCell[][],
  options?: Pick<GridDrawOptions, "palette">,
): Cursor {
  if (rows.length === 0) return cursor;

  const palette = options?.palette ?? defaultGridPalette();
  const heights = rows.map((cells) => rowHeight(doc, cells));
  const totalH = heights.reduce((sum, height) => sum + height, 0);
  const w = contentWidth();
  const x0 = reportTheme.margin;

  const cur = doc.ensureSpace(cursor, totalH + GRID_PAGE_PAD);
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
    for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
      const cell = cells[cellIndex]!;
      const style = cellStyle(cell, palette);
      drawCellBackground(
        cur.page,
        x,
        bottom,
        cell.width,
        height,
        style.bg,
        cornerRadii(rowIndex, rows.length, cellIndex, cells.length),
      );
      drawCellText(doc, cur.page, cell, x, yTop, height, palette);
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
        palette.line,
      );
    }

    let x = x0;
    for (let colIndex = 0; colIndex < cells.length - 1; colIndex += 1) {
      x += cells[colIndex]!.width;
      drawGridLine(
        cur.page,
        { x, y: bottom },
        { x, y: top },
        palette.line,
      );
    }
  }

  drawRoundedRect(cur.page, {
    x: x0,
    y: blockBottom,
    width: w,
    height: totalH,
    radius: GRID_RADIUS,
    borderColor: palette.border,
    borderWidth: OUTER_BORDER,
  });

  return { ...cur, y: blockBottom - 12 };
}

export type GridPageBatch = {
  start: number;
  end: number;
  newPageBefore: boolean;
};

function resolveGridSpans(rowCount: number, spans?: readonly number[]): number[] {
  if (rowCount <= 0) return [];
  if (!spans || spans.length === 0) return [rowCount];
  const valid =
    spans.every((span) => span > 0) && spans.reduce((sum, span) => sum + span, 0) === rowCount;
  return valid ? [...spans] : [rowCount];
}

/**
 * Agrupa linhas para cada bloco desenhado, sem deixar sobras de uma ação
 * virarem tabelas soltas no rodapé ou na página seguinte.
 */
export function planGridPageBatches(
  heights: readonly number[],
  spans: readonly number[],
  firstAvailable: number,
  pageAvailable: number,
): GridPageBatch[] {
  const groups: Array<{ start: number; end: number; height: number }> = [];
  let offset = 0;
  for (const span of resolveGridSpans(heights.length, spans)) {
    const end = offset + span;
    const height = heights.slice(offset, end).reduce((sum, value) => sum + value, 0);
    groups.push({ start: offset, end, height });
    offset = end;
  }

  const batches: GridPageBatch[] = [];
  let remaining = firstAvailable;
  let batchStart = -1;
  let batchEnd = -1;
  let newPageBefore = false;

  const commit = () => {
    if (batchStart < 0) return;
    batches.push({ start: batchStart, end: batchEnd, newPageBefore });
    batchStart = -1;
    batchEnd = -1;
    newPageBefore = false;
  };

  const append = (start: number, end: number) => {
    if (batchStart < 0) batchStart = start;
    batchEnd = end;
  };

  const startNewPage = () => {
    commit();
    newPageBefore = true;
    remaining = pageAvailable;
  };

  for (const group of groups) {
    if (group.height > remaining) {
      const onFreshPage = batchStart < 0 && remaining >= pageAvailable - 0.5;
      if (!onFreshPage) startNewPage();
    }

    if (group.height <= remaining) {
      append(group.start, group.end);
      remaining -= group.height;
      continue;
    }

    for (let row = group.start; row < group.end; row += 1) {
      const height = heights[row]!;
      if (batchStart >= 0 && height > remaining) startNewPage();
      append(row, row + 1);
      remaining = Math.max(0, remaining - height);
    }
  }
  commit();
  return batches;
}

function isGridPageTop(cursor: Cursor): boolean {
  return cursor.y >= reportTheme.page.h - reportTheme.margin - 0.5;
}

function gridAvailableHeight(doc: PdfGridHost, cursor: Cursor): number {
  return cursor.y - doc.contentBottom - GRID_PAGE_PAD;
}

function gridPageCapacity(doc: PdfGridHost): number {
  return reportTheme.page.h - reportTheme.margin - doc.contentBottom - GRID_PAGE_PAD;
}

/** Quebra a grade só entre grupos que cabem juntos; não solta linhas de uma ação. */
export function drawGridBlockPaginated(
  doc: PdfGridHost,
  cursor: Cursor,
  rows: GridCell[][],
  options?: GridDrawOptions,
): Cursor {
  if (rows.length === 0) return cursor;

  const heights = rows.map((cells) => rowHeight(doc, cells));
  const batches = planGridPageBatches(
    heights,
    resolveGridSpans(rows.length, options?.spans),
    Math.max(0, gridAvailableHeight(doc, cursor)),
    Math.max(0, gridPageCapacity(doc)),
  );

  let cur = cursor;
  for (const batch of batches) {
    if (batch.newPageBefore && !isGridPageTop(cur)) {
      cur = doc.ensureSpace(cur, gridAvailableHeight(doc, cur) + 1);
    }
    cur = drawGridBlock(doc, cur, rows.slice(batch.start, batch.end), {
      palette: options?.palette,
    });
  }
  return cur;
}

/** Linha de grade institucional (mesmo bloco visual das tabelas de critério). */
export function drawGridRow(
  doc: PdfGridHost,
  cursor: Cursor,
  cells: GridCell[],
): Cursor {
  return drawGridBlock(doc, cursor, [cells]);
}

export function gridColumnWidth(span: 1 | 2 | 3 | 4 = 1): number {
  return (contentWidth() / 4) * span;
}

export function headerRowCells(title: string): GridCell[] {
  return [{ text: title, width: contentWidth(), bold: true, tone: "header", align: "left" }];
}

export function subheaderRowCells(title: string): GridCell[] {
  return [
    { text: title, width: contentWidth(), bold: true, tone: "subheader", align: "left" },
  ];
}

export function headerValueRowCells(label: string, value: string): GridCell[] {
  const col = gridColumnWidth();
  return [
    { text: label, width: col, bold: true, tone: "header", align: "left" },
    { text: value, width: gridColumnWidth(3), tone: "value", align: "left" },
  ];
}

export function noticeRowCells(text: string): GridCell[] {
  const col = gridColumnWidth();
  return [
    { text: "", width: col, bold: true, tone: "label", align: "left" },
    { text, width: gridColumnWidth(3), tone: "notice", align: "left" },
  ];
}

export function labelValueRowCells(label: string, value: string): GridCell[] {
  const col = gridColumnWidth();
  return [
    { text: label, width: col, bold: true, tone: "label", align: "left" },
    { text: value, width: gridColumnWidth(3), tone: "value", align: "left" },
  ];
}

export function quadRowCells(a: string, b: string, c: string, d: string): GridCell[] {
  const col = gridColumnWidth();
  return [
    { text: a, width: col, bold: true, tone: "label", align: "left" },
    { text: b, width: col, tone: "value", align: "left" },
    { text: c, width: col, bold: true, tone: "label", align: "left" },
    { text: d, width: col, tone: "value", align: "left" },
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
