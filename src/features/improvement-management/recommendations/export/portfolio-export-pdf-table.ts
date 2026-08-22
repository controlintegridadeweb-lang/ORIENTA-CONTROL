import { rgb } from "pdf-lib";
import {
  basicPdfContentWidth,
  ensureBasicPdfSpace,
  wrapBasicPdfText,
  type BasicPdfTextContext,
} from "@/shared/export/basic-pdf-text";
import type { RecommendationPortfolioExportActionView } from "./portfolio-export-types";
import { drawPdfLine, PORTFOLIO_PDF_INK, PORTFOLIO_PDF_MUTED } from "./portfolio-export-pdf-layout";

export const PORTFOLIO_EMPTY_ACTIONS_COPY =
  "Nenhuma ação cadastrada para esta recomendação.";

const HEADER_BG = rgb(0.95, 0.96, 0.98);
const BORDER = rgb(0.82, 0.84, 0.86);
const CELL_PAD = 5;
const CELL_SIZE = 8;
const HEADER_SIZE = 7;
const ROW_LINE = 11;

export type ActionTableColumnKey =
  | "title"
  | "responsible"
  | "startDate"
  | "endDate"
  | "status"
  | "progress"
  | "updatedAt";

export type ActionTableColumnSpec = {
  key: ActionTableColumnKey;
  header: string;
  weight: number;
};

export const PORTFOLIO_ACTION_COLUMN_SPECS: readonly ActionTableColumnSpec[] = [
  { key: "title", header: "Ação", weight: 2.5 },
  { key: "responsible", header: "Responsável", weight: 1.3 },
  { key: "startDate", header: "Início", weight: 0.8 },
  { key: "endDate", header: "Final", weight: 0.8 },
  { key: "status", header: "Situação", weight: 1.15 },
  { key: "progress", header: "Progresso", weight: 0.75 },
  { key: "updatedAt", header: "Última atualização", weight: 1.2 },
];

export const ACTION_PLAN_ACTION_COLUMN_SPECS: readonly ActionTableColumnSpec[] = [
  { key: "title", header: "Ação", weight: 2.8 },
  { key: "responsible", header: "Responsável", weight: 1.4 },
  { key: "startDate", header: "Início", weight: 0.9 },
  { key: "endDate", header: "Final", weight: 0.9 },
  { key: "status", header: "Situação", weight: 1.2 },
  { key: "progress", header: "Progresso", weight: 0.8 },
];

type ActionColumn = {
  key: ActionTableColumnKey;
  header: string;
  width: number;
};

function tableOrigin(ctx: BasicPdfTextContext, inset: number): number {
  return ctx.marginX + inset;
}

function tableWidth(ctx: BasicPdfTextContext, inset: number): number {
  return basicPdfContentWidth(ctx) - inset * 2;
}

function tableColumns(
  ctx: BasicPdfTextContext,
  inset: number,
  specs: readonly ActionTableColumnSpec[] = PORTFOLIO_ACTION_COLUMN_SPECS,
): ActionColumn[] {
  const width = tableWidth(ctx, inset);
  const totalWeight = specs.reduce((sum, column) => sum + column.weight, 0);
  return specs.map((column) => ({
    key: column.key,
    header: column.header,
    width: (column.weight / totalWeight) * width,
  }));
}

function wrapCell(
  ctx: BasicPdfTextContext,
  text: string,
  width: number,
  size: number,
  bold = false,
): string[] {
  return wrapBasicPdfText(text, bold ? ctx.bold : ctx.font, size, width - CELL_PAD * 2);
}

function headerHeight(ctx: BasicPdfTextContext, columns: ActionColumn[]): number {
  let lines = 1;
  for (const column of columns) {
    lines = Math.max(lines, wrapCell(ctx, column.header, column.width, HEADER_SIZE, true).length);
  }
  return Math.max(18, lines * ROW_LINE + 8);
}

function rowHeight(
  ctx: BasicPdfTextContext,
  columns: ActionColumn[],
  action: RecommendationPortfolioExportActionView,
): number {
  let lines = 1;
  for (const column of columns) {
    lines = Math.max(lines, wrapCell(ctx, action[column.key], column.width, CELL_SIZE).length);
  }
  return Math.max(ROW_LINE + 8, lines * ROW_LINE + 8);
}

function drawHeader(ctx: BasicPdfTextContext, columns: ActionColumn[], inset: number): void {
  const height = headerHeight(ctx, columns);
  const width = tableWidth(ctx, inset);
  const origin = tableOrigin(ctx, inset);
  ensureBasicPdfSpace(ctx, height);
  const top = ctx.y;
  ctx.page.drawRectangle({
    x: origin,
    y: top - height,
    width,
    height,
    color: HEADER_BG,
    borderColor: BORDER,
    borderWidth: 0.5,
  });

  let x = origin;
  for (const column of columns) {
    const lines = wrapCell(ctx, column.header, column.width, HEADER_SIZE, true);
    let textY = top - 12;
    for (const line of lines) {
      drawPdfLine(ctx, line, x + CELL_PAD, textY, HEADER_SIZE, {
        bold: true,
        color: PORTFOLIO_PDF_MUTED,
      });
      textY -= ROW_LINE;
    }
    x += column.width;
  }
  ctx.y -= height;
}

function drawRow(
  ctx: BasicPdfTextContext,
  columns: ActionColumn[],
  action: RecommendationPortfolioExportActionView,
  height: number,
  inset: number,
): void {
  const width = tableWidth(ctx, inset);
  const origin = tableOrigin(ctx, inset);
  const top = ctx.y;
  ctx.page.drawRectangle({
    x: origin,
    y: top - height,
    width,
    height,
    color: rgb(1, 1, 1),
    borderColor: BORDER,
    borderWidth: 0.4,
  });

  let x = origin;
  for (const column of columns) {
    const lines = wrapCell(ctx, action[column.key], column.width, CELL_SIZE);
    let textY = top - 13;
    for (const line of lines) {
      drawPdfLine(ctx, line, x + CELL_PAD, textY, CELL_SIZE, { color: PORTFOLIO_PDF_INK });
      textY -= ROW_LINE;
    }
    x += column.width;
  }
  ctx.y -= height;
}

export function measureActionTableHeight(
  ctx: BasicPdfTextContext,
  actions: readonly RecommendationPortfolioExportActionView[],
  inset = 0,
  specs: readonly ActionTableColumnSpec[] = PORTFOLIO_ACTION_COLUMN_SPECS,
): number {
  if (actions.length === 0) return 14;
  const columns = tableColumns(ctx, inset, specs);
  return (
    headerHeight(ctx, columns) +
    actions.reduce((total, action) => total + rowHeight(ctx, columns, action), 0)
  );
}

export function drawPortfolioActionTable(
  ctx: BasicPdfTextContext,
  actions: readonly RecommendationPortfolioExportActionView[],
  inset = 0,
  specs: readonly ActionTableColumnSpec[] = PORTFOLIO_ACTION_COLUMN_SPECS,
): void {
  if (actions.length === 0) return;

  const columns = tableColumns(ctx, inset, specs);
  drawHeader(ctx, columns, inset);

  for (const action of actions) {
    const height = rowHeight(ctx, columns, action);
    if (ctx.y - height < ctx.bottomY) {
      ctx.page = ctx.pdf.addPage([...ctx.pageSize]);
      ctx.y = ctx.topY;
      drawHeader(ctx, columns, inset);
    }
    drawRow(ctx, columns, action, height, inset);
  }
}
