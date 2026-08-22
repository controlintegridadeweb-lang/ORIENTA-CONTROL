import { rgb, type RGB } from "pdf-lib";
import {
  basicPdfContentWidth,
  drawBasicPdfSpacer,
  drawBasicPdfText,
  ensureBasicPdfSpace,
  measureBasicPdfParagraph,
  wrapBasicPdfText,
  type BasicPdfTextContext,
} from "@/shared/export/basic-pdf-text";
import { hexToPdfRgb } from "@/shared/export/pdf-color";
import { drawRoundedRect } from "@/shared/export/pdf-rounded-rect";
import { latinPdfSafe } from "@/shared/export/text";
import { getAxisTheme } from "@/shared/theme/axis-theme";
import {
  PORTFOLIO_EXPORT_MISSING_VALUE,
  type RecommendationPortfolioExportContextView,
} from "./portfolio-export-types";

export const PORTFOLIO_PDF_INK = rgb(0.1, 0.1, 0.1);
export const PORTFOLIO_PDF_MUTED = rgb(0.38, 0.4, 0.43);
const PORTFOLIO_PDF_WHITE = rgb(1, 1, 1);
const CONTEXT_BG = rgb(0.898, 0.957, 0.973);

/** Ritmo vertical único do relatório — medida e desenho usam os mesmos tokens. */
export const PORTFOLIO_PDF_SPACE = {
  afterTitle: 10,
  afterContext: 16,
  afterAxis: 14,
  afterSection: 14,
  afterQuestion: 14,
  afterRecommendation: 12,
  afterStatus: 12,
  betweenRecommendations: 16,
  contextInner: 14,
  contextField: 10,
  cardPad: 14,
  recBoxPad: 10,
  labelToValue: 6,
  accentWidth: 4,
  cardRadius: 6,
  axisRadius: 5,
} as const;

const VALUE_SIZE = 10;
const BODY_LEADING = 15;

export type PdfContextField = readonly [label: string, value: string];

export type PdfContextFields = {
  left: readonly PdfContextField[];
  right: readonly PdfContextField[];
};

export function portfolioPdfContextFields(
  context: RecommendationPortfolioExportContextView,
): PdfContextFields {
  return {
    left: [
      ["Formulário", context.formName],
      ["Versão", context.formVersion ?? PORTFOLIO_EXPORT_MISSING_VALUE],
    ],
    right: [
      ["Órgão", context.organizationName],
      ["Ciclo", context.period],
    ],
  };
}

export function actionPlanPdfContextFields(
  context: RecommendationPortfolioExportContextView,
  issuedOnLabel: string,
): PdfContextFields {
  return {
    left: [
      ["Formulário", context.formName],
      ["Órgão", context.organizationName],
    ],
    right: [
      ["Ciclo", context.period],
      ["Data de emissão", issuedOnLabel],
    ],
  };
}

export function portfolioAxisBarColor(axisName: string): RGB {
  return hexToPdfRgb(getAxisTheme(axisName).primary);
}

export function drawPdfLine(
  ctx: BasicPdfTextContext,
  text: string,
  x: number,
  y: number,
  size: number,
  options: { bold?: boolean; oblique?: boolean; color?: RGB } = {},
): void {
  const safe = latinPdfSafe(text);
  if (!safe) return;
  const font = options.bold ? ctx.bold : options.oblique ? ctx.oblique : ctx.font;
  ctx.page.drawText(safe, {
    x,
    y,
    size,
    font,
    color: options.color ?? PORTFOLIO_PDF_INK,
  });
}

function measureLabeledValue(
  ctx: BasicPdfTextContext,
  value: string,
  width: number,
): number {
  return (
    12 +
    PORTFOLIO_PDF_SPACE.labelToValue +
    measureBasicPdfParagraph(value, ctx.font, VALUE_SIZE, width, BODY_LEADING)
  );
}

function drawLabeledValue(
  ctx: BasicPdfTextContext,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
): number {
  drawPdfLine(ctx, label, x, y, 8, { bold: true, color: PORTFOLIO_PDF_MUTED });
  let cursor = y - 12 - PORTFOLIO_PDF_SPACE.labelToValue;
  for (const line of wrapBasicPdfText(value, ctx.font, VALUE_SIZE, width)) {
    drawPdfLine(ctx, line, x, cursor, VALUE_SIZE);
    cursor -= BODY_LEADING;
  }
  return cursor;
}

export function drawPortfolioContextBlock(
  ctx: BasicPdfTextContext,
  fields: PdfContextFields,
): void {
  drawBasicPdfText(ctx, "Contexto", { size: 10, bold: true });
  drawBasicPdfSpacer(ctx, 8);

  const width = basicPdfContentWidth(ctx);
  const colGap = 20;
  const inner = PORTFOLIO_PDF_SPACE.contextInner;
  const colWidth = (width - inner * 2 - colGap) / 2;
  const leftFields = fields.left;
  const rightFields = fields.right;

  const columnHeight = (column: readonly PdfContextField[]): number =>
    column.reduce((total, [, value], index) => {
      const gap = index < column.length - 1 ? PORTFOLIO_PDF_SPACE.contextField : 0;
      return total + measureLabeledValue(ctx, value, colWidth) + gap;
    }, 0);

  const boxHeight = Math.max(columnHeight(leftFields), columnHeight(rightFields)) + inner * 2;
  ensureBasicPdfSpace(ctx, boxHeight + 4);

  drawRoundedRect(ctx.page, {
    x: ctx.marginX,
    y: ctx.y - boxHeight,
    width,
    height: boxHeight,
    radius: PORTFOLIO_PDF_SPACE.cardRadius,
    color: CONTEXT_BG,
  });

  let leftY = ctx.y - inner - 8 + 1;
  let rightY = leftY;
  const leftX = ctx.marginX + inner;
  const rightX = leftX + colWidth + colGap;
  for (const [label, value] of leftFields) {
    leftY = drawLabeledValue(ctx, label, value, leftX, leftY, colWidth) - PORTFOLIO_PDF_SPACE.contextField;
  }
  for (const [label, value] of rightFields) {
    rightY = drawLabeledValue(ctx, label, value, rightX, rightY, colWidth) - PORTFOLIO_PDF_SPACE.contextField;
  }
  ctx.y -= boxHeight + PORTFOLIO_PDF_SPACE.afterContext;
}

export function drawPortfolioAxisBar(ctx: BasicPdfTextContext, axisName: string): void {
  const width = basicPdfContentWidth(ctx);
  const size = 11;
  const label = `Eixo - ${axisName}`;
  const lines = wrapBasicPdfText(label, ctx.bold, size, width - 24);
  const height = Math.max(26, lines.length * 16 + 10);
  ensureBasicPdfSpace(ctx, height + PORTFOLIO_PDF_SPACE.afterAxis);

  drawRoundedRect(ctx.page, {
    x: ctx.marginX,
    y: ctx.y - height,
    width,
    height,
    radius: PORTFOLIO_PDF_SPACE.axisRadius,
    color: portfolioAxisBarColor(axisName),
  });

  const block = lines.length * 16;
  let textY = ctx.y - (height - block) / 2 - size + 1;
  for (const line of lines) {
    const safe = latinPdfSafe(line);
    const textWidth = ctx.bold.widthOfTextAtSize(safe, size);
    drawPdfLine(ctx, line, ctx.marginX + (width - textWidth) / 2, textY, size, {
      bold: true,
      color: PORTFOLIO_PDF_WHITE,
    });
    textY -= 16;
  }
  ctx.y -= height + PORTFOLIO_PDF_SPACE.afterAxis;
}

export function drawPortfolioSectionHeading(
  ctx: BasicPdfTextContext,
  sectionDisplayNumber: number,
  sectionName: string,
): void {
  drawBasicPdfText(ctx, `Seção ${sectionDisplayNumber} - ${sectionName}`, {
    size: 11,
    bold: true,
    lineHeight: 16,
  });
  drawBasicPdfSpacer(ctx, PORTFOLIO_PDF_SPACE.afterSection);
}
