import { latinPdfSafe } from "@/shared/export/text";
import type { Cursor, OrientaPdfDocument } from "./document";
import { contentWidth, reportTheme } from "./theme";

export type ReportTableColumn = {
  key: string;
  header: string;
  width: number;
  align?: "left" | "right";
};

export type ReportTableRow = Record<string, string>;

export type ReportTableOptions = {
  zebra?: boolean;
};

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

function cellX(
  column: ReportTableColumn,
  x: number,
  text: string,
  size: number,
  font: OrientaPdfDocument["fonts"]["regular"],
): number {
  if (column.align !== "right") return x + CELL_PAD;
  const width = font.widthOfTextAtSize(text, size);
  return x + column.width - CELL_PAD - width;
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
    color: reportTheme.tableHeader,
  });
  for (const column of columns) {
    const label = latinPdfSafe(column.header);
    cur.page.drawText(label, {
      x: cellX(column, x, label, 8, doc.fonts.bold),
      y: cur.y - 12,
      size: 8,
      font: doc.fonts.bold,
      color: reportTheme.slate600,
      maxWidth: column.width - CELL_PAD * 2,
    });
    x += column.width;
  }
  cur.page.drawLine({
    start: { x: reportTheme.margin, y: cur.y - HEADER_H },
    end: { x: reportTheme.margin + contentWidth(), y: cur.y - HEADER_H },
    thickness: 0.4,
    color: reportTheme.slate200,
  });
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
  opts: ReportTableOptions = {},
): Cursor {
  if (rows.length === 0) return cursor;

  let cur = drawHeader(doc, cursor, columns);
  const cellSize = 8;

  rows.forEach((row, index) => {
    const height = rowHeight(doc, columns, row, cellSize);
    if (cur.y - height < doc.contentBottom) {
      cur = doc.newPage();
      cur = drawHeader(doc, cur, columns);
    }

    const top = cur.y;
    const zebra = opts.zebra && index % 2 === 0;
    cur.page.drawRectangle({
      x: reportTheme.margin,
      y: top - height,
      width: contentWidth(),
      height,
      color: zebra ? reportTheme.tableStripe : reportTheme.white,
    });

    let x = reportTheme.margin;
    for (const column of columns) {
      const lines = wrapCell(doc, row[column.key] ?? "", column.width, cellSize);
      let ly = top - 11;
      for (const line of lines) {
        cur.page.drawText(line, {
          x: cellX(column, x, line, cellSize, doc.fonts.regular),
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
    cur.page.drawLine({
      start: { x: reportTheme.margin, y: top - height },
      end: { x: reportTheme.margin + contentWidth(), y: top - height },
      thickness: 0.35,
      color: reportTheme.slate200,
    });
    cur = { ...cur, y: top - height };
  });

  return { ...cur, y: cur.y - 8 };
}
