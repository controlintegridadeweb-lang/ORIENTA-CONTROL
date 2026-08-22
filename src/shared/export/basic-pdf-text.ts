import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
  type RGB,
} from "pdf-lib";
import { latinPdfSafe } from "@/shared/export/text";

export type BasicPdfTextContext = {
  pdf: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  oblique: PDFFont;
  page: PDFPage;
  y: number;
  marginX: number;
  topY: number;
  bottomY: number;
  pageSize: readonly [number, number];
};

export async function createBasicPdfTextContext({
  pageSize = [595, 842],
  marginX = 50,
  topY = 800,
  bottomY = 60,
}: {
  pageSize?: readonly [number, number];
  marginX?: number;
  topY?: number;
  bottomY?: number;
} = {}): Promise<BasicPdfTextContext> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const oblique = await pdf.embedFont(StandardFonts.HelveticaOblique);
  return {
    pdf,
    font,
    bold,
    oblique,
    page: pdf.addPage([...pageSize]),
    y: topY,
    marginX,
    topY,
    bottomY,
    pageSize,
  };
}

export function basicPdfContentWidth(ctx: BasicPdfTextContext, indent = 0): number {
  return ctx.pageSize[0] - 2 * ctx.marginX - indent;
}

export function basicPdfLineHeight(size: number): number {
  return size + 4;
}

export function ensureBasicPdfSpace(ctx: BasicPdfTextContext, needed: number): void {
  if (ctx.y - needed >= ctx.bottomY) return;
  ctx.page = ctx.pdf.addPage([...ctx.pageSize]);
  ctx.y = ctx.topY;
}

function breakLongToken(
  token: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  if (font.widthOfTextAtSize(token, size) <= maxWidth) return [token];
  const parts: string[] = [];
  let current = "";
  for (const char of token) {
    const candidate = current + char;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      parts.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  if (current) parts.push(current);
  return parts.length > 0 ? parts : [""];
}

function wrapSingleParagraph(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    for (const token of breakLongToken(word, font, size, maxWidth)) {
      const candidate = current ? `${current} ${token}` : token;
      if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(current);
        current = token;
      } else {
        current = candidate;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Quebra texto na largura útil, inclusive palavras longas e quebras de linha. */
export function wrapBasicPdfText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const safe = latinPdfSafe(text);
  const paragraphs = safe.split(/\r?\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    lines.push(...wrapSingleParagraph(paragraph, font, size, maxWidth));
  }
  return lines.length > 0 ? lines : [""];
}

export function measureBasicPdfParagraph(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  lineHeight = basicPdfLineHeight(size),
): number {
  return wrapBasicPdfText(text, font, size, maxWidth).length * lineHeight;
}

export function drawBasicPdfText(
  ctx: BasicPdfTextContext,
  text: string,
  options: {
    size?: number;
    bold?: boolean;
    color?: RGB;
    indent?: number;
    lineHeight?: number;
  } = {},
): void {
  const size = options.size ?? 11;
  const step = options.lineHeight ?? basicPdfLineHeight(size);
  const safe = latinPdfSafe(text);
  if (!safe) {
    ctx.y -= step;
    return;
  }
  ensureBasicPdfSpace(ctx, step);
  ctx.page.drawText(safe, {
    x: ctx.marginX + (options.indent ?? 0),
    y: ctx.y,
    size,
    font: options.bold ? ctx.bold : ctx.font,
    color: options.color ?? rgb(0.1, 0.1, 0.1),
  });
  ctx.y -= step;
}

export function drawBasicPdfDivider(ctx: BasicPdfTextContext): void {
  ensureBasicPdfSpace(ctx, 8);
  ctx.page.drawLine({
    start: { x: ctx.marginX, y: ctx.y },
    end: { x: ctx.pageSize[0] - ctx.marginX, y: ctx.y },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.85),
  });
  ctx.y -= 10;
}

export function drawBasicPdfSpacer(ctx: BasicPdfTextContext, height = 8): void {
  ensureBasicPdfSpace(ctx, height);
  ctx.y -= height;
}

export function drawBasicPdfParagraph(
  ctx: BasicPdfTextContext,
  text: string,
  options: {
    indent?: number;
    size?: number;
    bold?: boolean;
    color?: RGB;
    lineHeight?: number;
  } = {},
): void {
  const size = options.size ?? 11;
  const indent = options.indent ?? 0;
  const maxWidth = basicPdfContentWidth(ctx, indent);
  const font = options.bold ? ctx.bold : ctx.font;
  for (const line of wrapBasicPdfText(text, font, size, maxWidth)) {
    drawBasicPdfText(ctx, line, {
      size,
      bold: options.bold,
      indent,
      color: options.color,
      lineHeight: options.lineHeight,
    });
  }
}
