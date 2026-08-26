import { formatPlatformDate, formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import { latinPdfSafe } from "@/shared/export/text";
import fs from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import type { OfficialReportData } from "@/features/reports/pdf/report-types";
import { contentWidth, reportTheme } from "./theme";

export type ReportFonts = {
  regular: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  italic: Awaited<ReturnType<PDFDocument["embedFont"]>>;
};

export type Cursor = { page: PDFPage; y: number };

export type TocEntry = {
  id: string;
  title: string;
  page: number;
  /** 0 = seção principal; 1 = eixo/subseção no sumário. */
  level: number;
};

export type ReportCoverAssets = {
  brandMark: PDFImage | null;
  decoTop: PDFImage | null;
  decoBottom: PDFImage | null;
};

async function tryEmbedPng(
  pdf: PDFDocument,
  relativePath: string,
): Promise<PDFImage | null> {
  try {
    const bytes = await fs.readFile(path.join(process.cwd(), relativePath));
    return pdf.embedPng(bytes);
  } catch {
    return null;
  }
}

export class OrientaPdfDocument {
  readonly pdf: PDFDocument;
  readonly fonts: ReportFonts;
  readonly data: OfficialReportData;
  logo: PDFImage | null = null;
  coverAssets: ReportCoverAssets = {
    brandMark: null,
    decoTop: null,
    decoBottom: null,
  };
  private pageIndex = -1;
  readonly coverPageIndex = 0;
  tocPageIndex = 1;
  readonly tocEntries: TocEntry[] = [];

  private constructor(pdf: PDFDocument, fonts: ReportFonts, data: OfficialReportData) {
    this.pdf = pdf;
    this.fonts = fonts;
    this.data = data;
  }

  static async create(data: OfficialReportData): Promise<OrientaPdfDocument> {
    const pdf = await PDFDocument.create();
    const fonts: ReportFonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold: await pdf.embedFont(StandardFonts.HelveticaBold),
      italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
    };
    const doc = new OrientaPdfDocument(pdf, fonts, data);
    doc.logo = await tryEmbedPng(pdf, path.join("public", "assets", "logo-orienta.png"));
    // Versões cortadas (sem padding 2000²) — escala visual previsível na capa.
    doc.coverAssets = {
      brandMark: await tryEmbedPng(pdf, path.join("public", "assets", "cover", "brand.png")),
      decoTop: await tryEmbedPng(
        pdf,
        path.join("public", "assets", "cover", "deco-top-left.png"),
      ),
      decoBottom: await tryEmbedPng(
        pdf,
        path.join("public", "assets", "cover", "deco-bottom-right.png"),
      ),
    };
    return doc;
  }

  get contentBottom(): number {
    return reportTheme.margin + reportTheme.footerH;
  }

  get contentTop(): number {
    return reportTheme.page.h - reportTheme.margin;
  }

  newPage(): Cursor {
    const page = this.pdf.addPage([reportTheme.page.w, reportTheme.page.h]);
    this.pageIndex += 1;
    page.drawRectangle({
      x: 0,
      y: 0,
      width: reportTheme.page.w,
      height: reportTheme.page.h,
      color: reportTheme.white,
    });
    return { page, y: this.contentTop };
  }

  /** Reserva a página de sumário (preenchida ao final da geração). */
  reserveTocPage(): Cursor {
    return this.newPage();
  }

  getPage(index: number): PDFPage {
    return this.pdf.getPages()[index]!;
  }

  get pageCount(): number {
    return this.pdf.getPageCount();
  }

  registerTocEntry(id: string, title: string, level = 0): void {
    this.tocEntries.push({
      id,
      title,
      page: this.pageIndex + 1,
      level,
    });
  }

  /**
   * Inicia seção principal em nova página, registra no sumário e desenha cabeçalho.
   */
  beginMajorSection(
    title: string,
    subtitle: string | undefined,
    tocId: string,
  ): Cursor {
    let cur = this.newPage();
    this.registerTocEntry(tocId, title);
    cur = this.drawSectionTitle(cur, title, subtitle, { forceTop: true });
    return cur;
  }

  ensureSpace(c: Cursor, needed: number): Cursor {
    if (c.y - needed < this.contentBottom) return this.newPage();
    return c;
  }

  /** Garante espaço para bloco indivisível (card, card de recomendação, etc.). */
  ensureBlock(c: Cursor, blockHeight: number): Cursor {
    return this.ensureSpace(c, blockHeight + reportTheme.sectionGap);
  }

  drawFooter(page: PDFPage, pageNum: number, totalPages: number): void {
    const y = 22;
    const label = `Página ${pageNum} de ${totalPages}`;

    page.drawLine({
      start: { x: reportTheme.margin, y: y + 12 },
      end: { x: reportTheme.page.w - reportTheme.margin, y: y + 12 },
      thickness: 0.4,
      color: reportTheme.slate200,
    });
    const labelW = this.fonts.regular.widthOfTextAtSize(label, 8);
    page.drawText(label, {
      x: (reportTheme.page.w - labelW) / 2,
      y,
      size: 8,
      font: this.fonts.regular,
      color: reportTheme.slate500,
    });
  }

  applyFooters(): void {
    const pages = this.pdf.getPages();
    const total = pages.length;
    pages.forEach((page, i) => {
      if (i === this.coverPageIndex || i === this.tocPageIndex) return;
      this.drawFooter(page, i + 1, total);
    });
  }

  formatDateShort(iso: string): string {
    try {
      return formatPlatformDate(iso, { day: "2-digit", month: "2-digit", year: "numeric" }, iso);
    } catch {
      return iso;
    }
  }

  chunkText(text: string, maxChars: number): string[] {
    const t = latinPdfSafe(text).replace(/\s+/g, " ").trim();
    if (!t) return [];
    if (t.length <= maxChars) return [t];
    const out: string[] = [];
    let rest = t;
    while (rest.length > maxChars) {
      const slice = rest.slice(0, maxChars);
      const sp = slice.lastIndexOf(" ");
      const br = sp > 40 ? sp : maxChars;
      const line = rest.slice(0, br).trim();
      if (line) out.push(line);
      rest = rest.slice(br).trim();
    }
    if (rest) out.push(rest);
    return out;
  }

  drawParagraph(
    c: Cursor,
    text: string,
    opts: {
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      indent?: number;
      gap?: number;
      maxWidth?: number;
    } = {},
  ): Cursor {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.fonts.bold : this.fonts.regular;
    const color = opts.color ?? reportTheme.slate700;
    const indent = opts.indent ?? 0;
    const gap = opts.gap ?? 0;
    const usable = (opts.maxWidth ?? contentWidth()) - indent;
    const maxChars = Math.floor(usable / (size * 0.52));
    let cur = { ...c, y: c.y - gap };
    for (const line of this.chunkText(text, maxChars)) {
      cur = this.ensureSpace(cur, reportTheme.line);
      cur.page.drawText(line, {
        x: reportTheme.margin + indent,
        y: cur.y,
        size,
        font,
        color,
        maxWidth: usable,
      });
      cur = { ...cur, y: cur.y - reportTheme.line };
    }
    return { ...cur, y: cur.y - 6 };
  }

  drawSectionTitle(
    c: Cursor,
    title: string,
    subtitle?: string,
    opts: { forceTop?: boolean } = {},
  ): Cursor {
    const blockH =
      reportTheme.titleBlockH +
      (subtitle ? 28 : 0) +
      reportTheme.minContentAfterTitle;

    let cur = c;
    if (opts.forceTop) {
      cur = { page: cur.page, y: this.contentTop };
    } else if (cur.y - blockH < this.contentBottom) {
      cur = this.newPage();
    } else {
      cur = { ...cur, y: cur.y - reportTheme.sectionGap };
      if (cur.y - reportTheme.titleBlockH < this.contentBottom) cur = this.newPage();
    }

    const titleSize = 17;
    const titleAscent = 13;
    const barH = 18;
    const barTop = cur.y;
    const titleBaseline = barTop - titleAscent;
    cur.page.drawRectangle({
      x: reportTheme.margin,
      y: titleBaseline - 4,
      width: 4,
      height: barH,
      color: reportTheme.brand,
    });
    cur.page.drawText(latinPdfSafe(title), {
      x: reportTheme.margin + 14,
      y: titleBaseline,
      size: titleSize,
      font: this.fonts.bold,
      color: reportTheme.slate900,
    });

    let y = titleBaseline - 20;
    if (subtitle) {
      const usable = contentWidth() - 14;
      const maxChars = Math.floor(usable / (9 * 0.52));
      for (const line of this.chunkText(latinPdfSafe(subtitle), maxChars)) {
        cur.page.drawText(line, {
          x: reportTheme.margin + 14,
          y,
          size: 9,
          font: this.fonts.regular,
          color: reportTheme.slate500,
          maxWidth: usable,
        });
        y -= 13;
      }
      y -= 4;
    } else {
      y = titleBaseline - 16;
    }

    cur.page.drawLine({
      start: { x: reportTheme.margin, y },
      end: { x: reportTheme.page.w - reportTheme.margin, y },
      thickness: 0.75,
      color: reportTheme.slate200,
    });
    return { ...cur, y: y - 18 };
  }

  drawSubsectionTitle(
    c: Cursor,
    title: string,
    subtitle?: string,
    opts: { accent?: ReturnType<typeof rgb> } = {},
  ): Cursor {
    const needed = 48 + (subtitle ? 24 : 0);
    let cur = this.ensureSpace(c, needed + 40);
    cur.page.drawText(latinPdfSafe(title), {
      x: reportTheme.margin,
      y: cur.y,
      size: 12,
      font: this.fonts.bold,
      color: opts.accent ?? reportTheme.brandDark,
    });
    cur = { ...cur, y: cur.y - 18 };
    if (subtitle) {
      cur = this.drawParagraph(cur, subtitle, { size: 9, color: reportTheme.slate500, gap: 0 });
    }
    cur.page.drawRectangle({
      x: reportTheme.margin,
      y: cur.y - 4,
      width: 56,
      height: 2,
      color: opts.accent ?? reportTheme.brand,
    });
    return { ...cur, y: cur.y - 16 };
  }

  drawRoundedCard(
    c: Cursor,
    height: number,
    opts: { fill?: ReturnType<typeof rgb>; border?: ReturnType<typeof rgb> } = {},
  ): {
    cursor: Cursor;
    innerX: number;
    innerY: number;
    innerW: number;
    innerH: number;
    midY: number;
  } {
    const pad = 16;
    const cur = this.ensureBlock(c, height);
    const w = contentWidth();
    const fill = opts.fill ?? reportTheme.white;
    const border = opts.border ?? reportTheme.slate200;
    const bottom = cur.y - height;
    cur.page.drawRectangle({
      x: reportTheme.margin,
      y: bottom,
      width: w,
      height,
      color: fill,
      borderColor: border,
      borderWidth: 0.75,
    });
    const innerY = cur.y - pad;
    const innerBottom = bottom + pad;
    return {
      cursor: { page: cur.page, y: bottom },
      innerX: reportTheme.margin + pad,
      innerY,
      innerW: w - pad * 2,
      innerH: height - pad * 2,
      midY: (innerY + innerBottom) / 2,
    };
  }

  formatDate(iso: string): string {
    try {
      return formatPlatformDateTime(iso, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }, iso);
    } catch {
      return iso;
    }
  }
}
