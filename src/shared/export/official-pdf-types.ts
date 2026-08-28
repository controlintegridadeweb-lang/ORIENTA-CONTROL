import type { PDFDocument, PDFPage } from "pdf-lib";

export type ReportFonts = {
  regular: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  italic: Awaited<ReturnType<PDFDocument["embedFont"]>>;
};

export type Cursor = { page: PDFPage; y: number };

/** Host mínimo para a grade institucional (relatório oficial e plano de ação). */
export type PdfGridHost = {
  fonts: ReportFonts;
  ensureSpace(c: Cursor, needed: number): Cursor;
};
