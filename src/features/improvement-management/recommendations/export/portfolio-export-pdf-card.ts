import { rgb } from "pdf-lib";
import {
  basicPdfContentWidth,
  drawBasicPdfSpacer,
  ensureBasicPdfSpace,
  measureBasicPdfParagraph,
  wrapBasicPdfText,
  type BasicPdfTextContext,
} from "@/shared/export/basic-pdf-text";
import { drawRoundedRect } from "@/shared/export/pdf-rounded-rect";
import { latinPdfSafe } from "@/shared/export/text";
import {
  drawPdfLine,
  portfolioAxisBarColor,
  PORTFOLIO_PDF_INK,
  PORTFOLIO_PDF_MUTED,
  PORTFOLIO_PDF_SPACE,
} from "./portfolio-export-pdf-layout";
import {
  ACTION_PLAN_ACTION_COLUMN_SPECS,
  drawPortfolioActionTable,
  measureActionTableHeight,
  PORTFOLIO_ACTION_COLUMN_SPECS,
  PORTFOLIO_EMPTY_ACTIONS_COPY,
  type ActionTableColumnSpec,
} from "./portfolio-export-pdf-table";
import {
  PORTFOLIO_EXPORT_MISSING_VALUE,
  type RecommendationPortfolioExportRecommendationView,
} from "./portfolio-export-types";

const CARD_BORDER = rgb(0.72, 0.75, 0.78);
const REC_BOX_BG = rgb(0.945, 0.949, 0.953);
const LABEL_SIZE = 10;
const VALUE_SIZE = 10;
const BODY_LEADING = 15;
const EMPTY_ACTIONS_SIZE = 9;
const EMPTY_ACTIONS_BLOCK = 16;
const ACTIONS_HEADING_SIZE = 10;
const ACTIONS_HEADING_BLOCK = 22;
const LAST_UPDATE_SIZE = 9;
const LAST_UPDATE_BLOCK = 18;

export type InstitutionalPdfCardOptions = {
  /** Quando false, o card termina em "Situação da recomendação" (sem tabela de ações). */
  includeActions?: boolean;
  actionsHeading?: string;
  columnSpecs?: readonly ActionTableColumnSpec[];
  showSingleActionLastUpdate?: boolean;
};

export const PORTFOLIO_PDF_CARD_OPTIONS: InstitutionalPdfCardOptions = {
  includeActions: false,
};

export const ACTION_PLAN_PDF_CARD_OPTIONS: InstitutionalPdfCardOptions = {
  includeActions: true,
  actionsHeading: "Plano de ação",
  columnSpecs: ACTION_PLAN_ACTION_COLUMN_SPECS,
  showSingleActionLastUpdate: true,
};

function includeActionsOf(options: InstitutionalPdfCardOptions | undefined): boolean {
  return options?.includeActions !== false;
}

function columnSpecsOf(
  options: InstitutionalPdfCardOptions | undefined,
): readonly ActionTableColumnSpec[] {
  return options?.columnSpecs ?? PORTFOLIO_ACTION_COLUMN_SPECS;
}

function lastUpdateLine(
  recommendation: RecommendationPortfolioExportRecommendationView,
): string | null {
  if (recommendation.actions.length !== 1) return null;
  const updatedAt = recommendation.actions[0]?.updatedAt;
  if (!updatedAt || updatedAt === PORTFOLIO_EXPORT_MISSING_VALUE) return null;
  return `Última atualização: ${updatedAt}`;
}

function innerTextWidth(ctx: BasicPdfTextContext): number {
  return basicPdfContentWidth(ctx) - PORTFOLIO_PDF_SPACE.cardPad * 2;
}

function recBoxTextWidth(ctx: BasicPdfTextContext): number {
  return (
    innerTextWidth(ctx) -
    PORTFOLIO_PDF_SPACE.accentWidth -
    PORTFOLIO_PDF_SPACE.recBoxPad * 2
  );
}

function measureLabeledParagraph(
  ctx: BasicPdfTextContext,
  text: string,
  width: number,
): number {
  return (
    LABEL_SIZE +
    PORTFOLIO_PDF_SPACE.labelToValue +
    measureBasicPdfParagraph(text, ctx.font, VALUE_SIZE, width, BODY_LEADING)
  );
}

function measureRecommendationBox(
  ctx: BasicPdfTextContext,
  recommendationText: string,
): number {
  return (
    PORTFOLIO_PDF_SPACE.recBoxPad * 2 +
    measureBasicPdfParagraph(
      recommendationText,
      ctx.font,
      VALUE_SIZE,
      recBoxTextWidth(ctx),
      BODY_LEADING,
    )
  );
}

export function measureRecommendationCardMinHeight(
  ctx: BasicPdfTextContext,
  recommendation: RecommendationPortfolioExportRecommendationView,
  options?: InstitutionalPdfCardOptions,
): number {
  const pad = PORTFOLIO_PDF_SPACE.cardPad;
  const header =
    measureLabeledParagraph(ctx, recommendation.questionText, innerTextWidth(ctx)) +
    PORTFOLIO_PDF_SPACE.afterQuestion +
    LABEL_SIZE +
    PORTFOLIO_PDF_SPACE.labelToValue +
    measureRecommendationBox(ctx, recommendation.recommendationText) +
    PORTFOLIO_PDF_SPACE.afterRecommendation +
    VALUE_SIZE +
    PORTFOLIO_PDF_SPACE.afterStatus +
    (includeActionsOf(options) ? EMPTY_ACTIONS_BLOCK : 0);
  return pad + header + pad;
}

function drawLines(
  ctx: BasicPdfTextContext,
  text: string,
  x: number,
  y: number,
  width: number,
): number {
  let cursor = y;
  for (const line of wrapBasicPdfText(text, ctx.font, VALUE_SIZE, width)) {
    drawPdfLine(ctx, line, x, cursor, VALUE_SIZE);
    cursor -= BODY_LEADING;
  }
  return cursor;
}

function drawRecommendationHighlight(
  ctx: BasicPdfTextContext,
  text: string,
  axisName: string,
  boxX: number,
  topY: number,
  boxWidth: number,
  boxHeight: number,
): void {
  const bottom = topY - boxHeight;
  drawRoundedRect(ctx.page, {
    x: boxX,
    y: bottom,
    width: boxWidth,
    height: boxHeight,
    radius: 4,
    color: REC_BOX_BG,
  });
  ctx.page.drawRectangle({
    x: boxX,
    y: bottom,
    width: PORTFOLIO_PDF_SPACE.accentWidth,
    height: boxHeight,
    color: portfolioAxisBarColor(axisName),
  });
  drawLines(
    ctx,
    text,
    boxX + PORTFOLIO_PDF_SPACE.accentWidth + PORTFOLIO_PDF_SPACE.recBoxPad,
    topY - PORTFOLIO_PDF_SPACE.recBoxPad - VALUE_SIZE + 2,
    recBoxTextWidth(ctx),
  );
}

function drawStatusLine(
  ctx: BasicPdfTextContext,
  status: string,
  x: number,
  y: number,
): void {
  const label = "Situação da recomendação: ";
  drawPdfLine(ctx, label, x, y, VALUE_SIZE, { bold: true, color: PORTFOLIO_PDF_INK });
  drawPdfLine(
    ctx,
    status,
    x + ctx.bold.widthOfTextAtSize(latinPdfSafe(label), VALUE_SIZE),
    y,
    VALUE_SIZE,
  );
}

/** Desenha pergunta, destaque e situação. Devolve o Y abaixo da linha de situação. */
function drawCardHeaderContent(
  ctx: BasicPdfTextContext,
  recommendation: RecommendationPortfolioExportRecommendationView,
  axisName: string,
  contentX: number,
  startY: number,
): number {
  const width = innerTextWidth(ctx);
  let y = startY - LABEL_SIZE;
  drawPdfLine(ctx, "Pergunta", contentX, y, LABEL_SIZE, { bold: true });
  y = drawLines(
    ctx,
    recommendation.questionText,
    contentX,
    y - PORTFOLIO_PDF_SPACE.labelToValue - VALUE_SIZE,
    width,
  );

  y -= PORTFOLIO_PDF_SPACE.afterQuestion - (BODY_LEADING - VALUE_SIZE);
  y -= LABEL_SIZE;
  drawPdfLine(ctx, "Recomendações", contentX, y, LABEL_SIZE, { bold: true });
  y -= PORTFOLIO_PDF_SPACE.labelToValue;

  const boxHeight = measureRecommendationBox(ctx, recommendation.recommendationText);
  drawRecommendationHighlight(
    ctx,
    recommendation.recommendationText,
    axisName,
    contentX,
    y,
    width,
    boxHeight,
  );
  y -= boxHeight + PORTFOLIO_PDF_SPACE.afterRecommendation + VALUE_SIZE;
  drawStatusLine(ctx, recommendation.recommendationStatus, contentX, y);
  return y - VALUE_SIZE;
}

function drawEmptyActions(ctx: BasicPdfTextContext, x: number, topY: number): number {
  drawPdfLine(ctx, PORTFOLIO_EMPTY_ACTIONS_COPY, x, topY - EMPTY_ACTIONS_SIZE, EMPTY_ACTIONS_SIZE, {
    oblique: true,
    color: PORTFOLIO_PDF_MUTED,
  });
  return topY - EMPTY_ACTIONS_BLOCK;
}

function strokeCardBorder(ctx: BasicPdfTextContext, top: number, bottom: number): void {
  const height = top - bottom;
  if (height <= 0) return;
  drawRoundedRect(ctx.page, {
    x: ctx.marginX,
    y: bottom,
    width: basicPdfContentWidth(ctx),
    height,
    radius: PORTFOLIO_PDF_SPACE.cardRadius,
    borderColor: CARD_BORDER,
    borderWidth: 1,
  });
}

function measureActionsBlock(
  ctx: BasicPdfTextContext,
  recommendation: RecommendationPortfolioExportRecommendationView,
  pad: number,
  options: InstitutionalPdfCardOptions | undefined,
): number {
  if (recommendation.actions.length === 0) return EMPTY_ACTIONS_BLOCK;
  const heading = options?.actionsHeading ? ACTIONS_HEADING_BLOCK : 0;
  const lastUpdate =
    options?.showSingleActionLastUpdate && lastUpdateLine(recommendation)
      ? LAST_UPDATE_BLOCK
      : 0;
  return (
    heading +
    measureActionTableHeight(ctx, recommendation.actions, pad, columnSpecsOf(options)) +
    lastUpdate
  );
}

function drawActionsHeading(ctx: BasicPdfTextContext, heading: string, x: number): void {
  drawPdfLine(ctx, heading, x, ctx.y - ACTIONS_HEADING_SIZE, ACTIONS_HEADING_SIZE, {
    bold: true,
  });
  ctx.y -= ACTIONS_HEADING_BLOCK;
}

function drawLastUpdateLine(ctx: BasicPdfTextContext, text: string, x: number): void {
  ctx.y -= 6;
  drawPdfLine(ctx, text, x, ctx.y - LAST_UPDATE_SIZE, LAST_UPDATE_SIZE, {
    color: PORTFOLIO_PDF_MUTED,
  });
  ctx.y -= LAST_UPDATE_BLOCK - 6;
}

function drawActionsContent(
  ctx: BasicPdfTextContext,
  recommendation: RecommendationPortfolioExportRecommendationView,
  pad: number,
  options: InstitutionalPdfCardOptions | undefined,
): void {
  const contentX = ctx.marginX + pad;
  if (options?.actionsHeading) {
    drawActionsHeading(ctx, options.actionsHeading, contentX);
  }
  drawPortfolioActionTable(ctx, recommendation.actions, pad, columnSpecsOf(options));
  const update = options?.showSingleActionLastUpdate
    ? lastUpdateLine(recommendation)
    : null;
  if (update) drawLastUpdateLine(ctx, update, contentX);
}

/** Card: pergunta, recomendação destacada e situação; ações só se `includeActions`. */
export function drawRecommendationCard(
  ctx: BasicPdfTextContext,
  recommendation: RecommendationPortfolioExportRecommendationView,
  axisName: string,
  options?: InstitutionalPdfCardOptions,
): void {
  const pad = PORTFOLIO_PDF_SPACE.cardPad;
  const contentX = ctx.marginX + pad;
  const showActions = includeActionsOf(options);
  const hasActions = showActions && recommendation.actions.length > 0;
  const minHeight = measureRecommendationCardMinHeight(ctx, recommendation, options);
  ensureBasicPdfSpace(ctx, Math.min(minHeight, ctx.topY - ctx.bottomY));

  const top = ctx.y;
  let y = drawCardHeaderContent(ctx, recommendation, axisName, contentX, top - pad);
  y -= PORTFOLIO_PDF_SPACE.afterStatus;

  if (!showActions) {
    y -= pad;
    strokeCardBorder(ctx, top, y);
    ctx.y = y - PORTFOLIO_PDF_SPACE.betweenRecommendations;
    return;
  }

  const actionsHeight = measureActionsBlock(ctx, recommendation, pad, options);
  const actionsFit = y - actionsHeight - pad >= ctx.bottomY;

  if (!hasActions) {
    y = drawEmptyActions(ctx, contentX, y);
    y -= pad;
    strokeCardBorder(ctx, top, y);
    ctx.y = y - PORTFOLIO_PDF_SPACE.betweenRecommendations;
    return;
  }

  if (actionsFit) {
    ctx.y = y;
    drawActionsContent(ctx, recommendation, pad, options);
    y = ctx.y - pad;
    strokeCardBorder(ctx, top, y);
    ctx.y = y - PORTFOLIO_PDF_SPACE.betweenRecommendations;
    return;
  }

  y -= pad;
  strokeCardBorder(ctx, top, y);
  ctx.y = y;
  drawBasicPdfSpacer(ctx, 8);
  drawActionsContent(ctx, recommendation, pad, options);
  drawBasicPdfSpacer(ctx, PORTFOLIO_PDF_SPACE.betweenRecommendations);
}
