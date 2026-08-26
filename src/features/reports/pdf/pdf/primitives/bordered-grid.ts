import { latinPdfSafe } from "@/shared/export/text";
import type { Cursor, OrientaPdfDocument, ReportFonts } from "../document";
import { contentWidth, reportTheme } from "../theme";

const PAD = 10;
const LINE = 12;
const MIN_H = 32;
const SIZE = 8;
const ASCENT = 6;

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

function rowHeight(doc: OrientaPdfDocument, cells: GridCell[]): number {
  let lines = 1;
  for (const cell of cells) {
    const font = cell.bold ? doc.fonts.bold : doc.fonts.regular;
    const wrapped = wrapLines(font, cell.text, SIZE, Math.max(12, cell.width - PAD * 2));
    lines = Math.max(lines, wrapped.length);
  }
  return Math.max(MIN_H, lines * LINE + PAD * 2);
}

function drawCellText(
  doc: OrientaPdfDocument,
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

/** Linha de grade com borda preta e texto centralizado (modelo de referência). */
export function drawGridRow(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  cells: GridCell[],
): Cursor {
  const height = rowHeight(doc, cells);
  let cur = doc.ensureSpace(cursor, height + 2);
  const top = cur.y;
  let x = reportTheme.margin;
  for (const cell of cells) {
    cur.page.drawRectangle({
      x,
      y: top - height,
      width: cell.width,
      height,
      color: cell.bold ? reportTheme.gridLabelBg : reportTheme.white,
      borderColor: reportTheme.gridInk,
      borderWidth: 0.75,
    });
    drawCellText(doc, cur.page, cell, x, top, height);
    x += cell.width;
  }
  return { ...cur, y: top - height };
}

export function labelValueRow(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  label: string,
  value: string,
): Cursor {
  const w = contentWidth();
  const labelW = w * 0.25;
  return drawGridRow(doc, cursor, [
    { text: label, width: labelW, bold: true },
    { text: value, width: w - labelW },
  ]);
}

export function quadRow(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  a: string,
  b: string,
  c: string,
  d: string,
): Cursor {
  const q = contentWidth() / 4;
  return drawGridRow(doc, cursor, [
    { text: a, width: q, bold: true },
    { text: b, width: q },
    { text: c, width: q, bold: true },
    { text: d, width: q },
  ]);
}

export function headerRow(doc: OrientaPdfDocument, cursor: Cursor, title: string): Cursor {
  return drawGridRow(doc, cursor, [
    { text: title, width: contentWidth(), bold: true },
  ]);
}
