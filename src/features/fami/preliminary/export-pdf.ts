import "server-only";

import { PDFDocument, StandardFonts, type RGB } from "pdf-lib";
import { businessToday } from "@/shared/datetime/business-date";
import { formatPlatformDate } from "@/shared/datetime/platform-date-time";
import { latinPdfSafe } from "@/shared/export/text";
import {
  drawGridBlock,
  labelValueRowCells,
} from "@/shared/export/official-pdf-bordered-grid";
import { contentWidth, reportTheme } from "@/shared/export/official-pdf-theme";
import type { Cursor, PdfGridHost, ReportFonts } from "@/shared/export/official-pdf-types";
import { famiPreliminaryLabels } from "@/shared/labels/official-labels";
import type { PreliminaryExportDetail } from "./export-detail";
import { preliminaryExportPeriodLabel } from "./export-detail";
import { formatPreliminaryPercentage, formatPreliminaryScore } from "./panel-presentation";
import { PRELIMINARY_EXPORT_DISCLAIMER } from "./export-xlsx";

const CIVIL_DATE_FORMAT = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
} as const;

class PreliminaryExportPdfDocument implements PdfGridHost {
  readonly pdf: PDFDocument;
  readonly fonts: ReportFonts;

  private constructor(pdf: PDFDocument, fonts: ReportFonts) {
    this.pdf = pdf;
    this.fonts = fonts;
  }

  static async create(): Promise<PreliminaryExportPdfDocument> {
    const pdf = await PDFDocument.create();
    const fonts: ReportFonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold: await pdf.embedFont(StandardFonts.HelveticaBold),
      italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
    };
    return new PreliminaryExportPdfDocument(pdf, fonts);
  }

  get contentBottom(): number {
    return reportTheme.margin + reportTheme.footerH;
  }

  get contentTop(): number {
    return reportTheme.page.h - reportTheme.margin;
  }

  newPage(): Cursor {
    const page = this.pdf.addPage([reportTheme.page.w, reportTheme.page.h]);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: reportTheme.page.w,
      height: reportTheme.page.h,
      color: reportTheme.white,
    });
    return { page, y: this.contentTop };
  }

  ensureSpace(c: Cursor, needed: number): Cursor {
    if (c.y - needed < this.contentBottom) return this.newPage();
    return c;
  }

  drawSectionTitle(cursor: Cursor, title: string, subtitle?: string): Cursor {
    let cur = this.ensureSpace(cursor, reportTheme.titleBlockH);
    const { page } = cur;
    const barH = 4;
    page.drawRectangle({
      x: reportTheme.margin,
      y: cur.y - barH,
      width: contentWidth(),
      height: barH,
      color: reportTheme.brand,
    });
    cur = { page, y: cur.y - barH - 14 };
    page.drawText(latinPdfSafe(title), {
      x: reportTheme.margin,
      y: cur.y - 14,
      size: 16,
      font: this.fonts.bold,
      color: reportTheme.slate900,
    });
    cur = { ...cur, y: cur.y - 22 };
    if (subtitle) {
      const lines = this.chunkText(subtitle, 110);
      for (const line of lines) {
        cur = this.ensureSpace(cur, 14);
        cur.page.drawText(latinPdfSafe(line), {
          x: reportTheme.margin,
          y: cur.y - 11,
          size: 9,
          font: this.fonts.regular,
          color: reportTheme.slate600,
        });
        cur = { ...cur, y: cur.y - 14 };
      }
    }
    return { ...cur, y: cur.y - 8 };
  }

  drawParagraph(
    cursor: Cursor,
    text: string,
    options: { size?: number; color?: RGB } = {},
  ): Cursor {
    const size = options.size ?? 10;
    const color = options.color ?? reportTheme.slate700;
    let cur = cursor;
    for (const line of this.chunkText(text, 105)) {
      cur = this.ensureSpace(cur, size + 6);
      cur.page.drawText(latinPdfSafe(line), {
        x: reportTheme.margin,
        y: cur.y - size,
        size,
        font: this.fonts.regular,
        color,
      });
      cur = { ...cur, y: cur.y - (size + 4) };
    }
    return cur;
  }

  chunkText(text: string, maxChars: number): string[] {
    const normalized = latinPdfSafe(text).replace(/\s+/g, " ").trim();
    if (!normalized) return [""];
    const words = normalized.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  applyFooters(): void {
    applyPreliminaryPdfFooters(this.pdf, this.fonts);
  }
}

function chunkTextByWidth(
  fonts: ReportFonts,
  text: string,
  size: number,
  maxWidth: number,
  font: ReportFonts["regular"] | ReportFonts["italic"] = fonts.regular,
): string[] {
  const normalized = latinPdfSafe(text).replace(/\s+/g, " ").trim();
  if (!normalized) return [""];
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";
  const fits = (value: string) => font.widthOfTextAtSize(value, size) <= maxWidth;

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (!fits(next) && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function applyPreliminaryPdfFooters(pdf: PDFDocument, fonts: ReportFonts): void {
  const pages = pdf.getPages();
  const total = pages.length;
  pages.forEach((page, index) => {
    const footerTop = reportTheme.margin + 6;
    page.drawLine({
      start: { x: reportTheme.margin, y: footerTop + 12 },
      end: { x: reportTheme.page.w - reportTheme.margin, y: footerTop + 12 },
      thickness: 0.4,
      color: reportTheme.slate200,
    });

    const disclaimerLines = chunkTextByWidth(
      fonts,
      PRELIMINARY_EXPORT_DISCLAIMER,
      7,
      contentWidth(),
      fonts.italic,
    ).slice(0, 2);
    let disclaimerY = footerTop + 4;
    for (const line of disclaimerLines) {
      page.drawText(line, {
        x: reportTheme.margin,
        y: disclaimerY,
        size: 7,
        font: fonts.italic,
        color: reportTheme.slate500,
      });
      disclaimerY -= 9;
    }

    const pageLabel = latinPdfSafe(`Pagina ${index + 1} de ${total}`);
    const pageLabelWidth = fonts.regular.widthOfTextAtSize(pageLabel, 8);
    page.drawText(pageLabel, {
      x: (reportTheme.page.w - pageLabelWidth) / 2,
      y: 22,
      size: 8,
      font: fonts.regular,
      color: reportTheme.slate500,
    });
  });
}

async function mergePdfParts(parts: readonly Uint8Array[]): Promise<PDFDocument> {
  const merged = await PDFDocument.create();
  for (const bytes of parts) {
    const part = await PDFDocument.load(bytes);
    const copied = await merged.copyPages(part, part.getPageIndices());
    for (const page of copied) merged.addPage(page);
  }
  return merged;
}

function drawSummaryGrid(
  doc: PreliminaryExportPdfDocument,
  cursor: Cursor,
  detail: PreliminaryExportDetail,
): Cursor {
  const { checkpoint } = detail;
  const issuedOn = formatPlatformDate(checkpoint.calculatedAt, CIVIL_DATE_FORMAT, checkpoint.calculatedAt);
  const delta =
    checkpoint.deltaPercentagePoints == null
      ? "—"
      : formatPreliminaryPercentage(checkpoint.deltaPercentagePoints);
  return drawGridBlock(doc, cursor, [
    labelValueRowCells("Organização", detail.organizationName),
    labelValueRowCells("Formulário", detail.formName),
    labelValueRowCells(
      "Período de referência",
      preliminaryExportPeriodLabel(checkpoint.referenceYear, checkpoint.quadrimester),
    ),
    labelValueRowCells("Data de corte", checkpoint.periodEnd),
    labelValueRowCells("Data de emissão", issuedOn),
    labelValueRowCells(famiPreliminaryLabels.officialFami, formatPreliminaryScore(checkpoint.official)),
    labelValueRowCells(famiPreliminaryLabels.panoramaLabel, formatPreliminaryScore(checkpoint.preliminary)),
    labelValueRowCells("Variação", delta),
    labelValueRowCells(
      famiPreliminaryLabels.criteriaNowScoring,
      String(detail.evolution?.criteriaNowScoring ?? 0),
    ),
    labelValueRowCells(
      famiPreliminaryLabels.recoveredPoints,
      String(detail.evolution?.recoveredPoints ?? 0),
    ),
  ]);
}

export async function generatePreliminaryExportPdf(
  detail: PreliminaryExportDetail,
  analysisBytes?: Uint8Array | null,
): Promise<{ filename: string; content: Uint8Array }> {
  const doc = await PreliminaryExportPdfDocument.create();
  let cur = doc.newPage();
  cur = doc.drawSectionTitle(
    cur,
    "FAMI preliminar quadrimestral",
    famiPreliminaryLabels.description,
  );
  drawSummaryGrid(doc, cur, detail);

  const parts: Uint8Array[] = [await doc.pdf.save()];
  if (analysisBytes && analysisBytes.byteLength > 0) parts.push(analysisBytes);

  const merged = await mergePdfParts(parts);
  const footerFonts: ReportFonts = {
    regular: await merged.embedFont(StandardFonts.Helvetica),
    bold: await merged.embedFont(StandardFonts.HelveticaBold),
    italic: await merged.embedFont(StandardFonts.HelveticaOblique),
  };
  applyPreliminaryPdfFooters(merged, footerFonts);

  return {
    filename: `fami-preliminar-${detail.checkpoint.referenceYear}-q${detail.checkpoint.quadrimester}-${businessToday()}.pdf`,
    content: await merged.save(),
  };
}
