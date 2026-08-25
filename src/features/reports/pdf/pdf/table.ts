import { latinPdfSafe } from "@/shared/export/text";
import type { Cursor, OrientaPdfDocument } from "./document";
import { contentWidth, reportTheme } from "./theme";

export type ReportTableColumn = {
  key: string;
  header: string;
  width: number;
};

export type ReportTableRow = Record<string, string>;

const HEADER_H = 18;
const CELL_PAD = 4;
const ROW_LINE = 11;

function wrapCell(
  doc: OrientaPdfDocument,
  text: string,
  width: number,
  size: number,
): string[] {
  const maxChars = Math.max(8, Math.floor((width - CELL_PAD * 2) / (size * 0.52)));
  return doc.chunkText(text, maxChars);
}

function rowHeight(
  doc: OrientaPdfDocument,
  columns: ReportTableColumn[],
  row: ReportTableRow,
  size: number,
): number {
  let lines = 1;
  for (const column of columns) {
    const wrapped = wrapCell(doc, row[column.key] ?? "", column.width, size);
    lines = Math.max(lines, wrapped.length);
  }
  return Math.max(ROW_LINE + 6, lines * ROW_LINE + 6);
}

function drawHeader(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  columns: ReportTableColumn[],
): Cursor {
  const cur = doc.ensureSpace(cursor, HEADER_H + 4);
  let x = reportTheme.margin;
  cur.page.drawRectangle({
    x: reportTheme.margin,
    y: cur.y - HEADER_H,
    width: contentWidth(),
    height: HEADER_H,
    color: reportTheme.slate100,
    borderColor: reportTheme.slate200,
    borderWidth: 0.5,
  });
  for (const column of columns) {
    cur.page.drawText(latinPdfSafe(column.header), {
      x: x + CELL_PAD,
      y: cur.y - 12,
      size: 8,
      font: doc.fonts.bold,
      color: reportTheme.slate600,
      maxWidth: column.width - CELL_PAD * 2,
    });
    x += column.width;
  }
  return { ...cur, y: cur.y - HEADER_H };
}

/**
 * Tabela compacta com repetição de cabeçalho ao atravessar páginas.
 * Textos longos quebram naturalmente; não há truncamento com reticências.
 */
export function drawReportTable(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  columns: ReportTableColumn[],
  rows: ReportTableRow[],
): Cursor {
  if (rows.length === 0) return cursor;

  let cur = drawHeader(doc, cursor, columns);
  const cellSize = 8;

  for (const row of rows) {
    const height = rowHeight(doc, columns, row, cellSize);
    if (cur.y - height < doc.contentBottom) {
      cur = doc.newPage();
      cur = drawHeader(doc, cur, columns);
    }

    const top = cur.y;
    cur.page.drawRectangle({
      x: reportTheme.margin,
      y: top - height,
      width: contentWidth(),
      height,
      color: reportTheme.white,
      borderColor: reportTheme.slate200,
      borderWidth: 0.4,
    });

    let x = reportTheme.margin;
    for (const column of columns) {
      const lines = wrapCell(doc, row[column.key] ?? "", column.width, cellSize);
      let ly = top - 11;
      for (const line of lines) {
        cur.page.drawText(line, {
          x: x + CELL_PAD,
          y: ly,
          size: cellSize,
          font: doc.fonts.regular,
          color: reportTheme.slate700,
          maxWidth: column.width - CELL_PAD * 2,
        });
        ly -= ROW_LINE;
      }
      x += column.width;
    }
    cur = { ...cur, y: top - height };
  }

  return { ...cur, y: cur.y - 8 };
}
