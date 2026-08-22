import { rgb } from "pdf-lib";
import { businessToday } from "@/shared/datetime/business-date";
import { formatPlatformDate } from "@/shared/datetime/platform-date-time";
import {
  createBasicPdfTextContext,
  drawBasicPdfDivider,
  drawBasicPdfParagraph,
  drawBasicPdfSpacer,
  drawBasicPdfText,
  ensureBasicPdfSpace,
  type BasicPdfTextContext,
} from "@/shared/export/basic-pdf-text";
import { latinPdfSafe } from "@/shared/export/text";
import type {
  RecommendationPortfolioExportActionView,
  RecommendationPortfolioExportSectionView,
} from "@/features/improvement-management/recommendations/export/portfolio-export-types";
import {
  actionPlanPdfContextFields,
  drawPortfolioAxisBar,
  drawPortfolioContextBlock,
  drawPortfolioSectionHeading,
  PORTFOLIO_PDF_MUTED,
  PORTFOLIO_PDF_SPACE,
} from "@/features/improvement-management/recommendations/export/portfolio-export-pdf-layout";
import type { ActionPlanExportData } from "./action-plan-export-types";

const CIVIL_DATE_FORMAT = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
} as const;

function progressPercent(action: RecommendationPortfolioExportActionView): number | null {
  const match = /^(\d{1,3})%$/.exec(action.progress.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

function sectionActionSummary(section: RecommendationPortfolioExportSectionView): {
  total: number;
  completed: number;
  averageProgress: number | null;
} {
  const actions = section.recommendations.flatMap((recommendation) => recommendation.actions);
  const progresses = actions
    .map(progressPercent)
    .filter((value): value is number => value != null);
  return {
    total: actions.length,
    completed: progresses.filter((value) => value >= 100).length,
    averageProgress:
      progresses.length === 0
        ? null
        : Math.round(progresses.reduce((sum, value) => sum + value, 0) / progresses.length),
  };
}

function drawRecommendationOrigins(
  ctx: BasicPdfTextContext,
  section: RecommendationPortfolioExportSectionView,
): void {
  drawBasicPdfText(ctx, "Recomendações de origem", { size: 10, bold: true });
  drawBasicPdfSpacer(ctx, 2);
  section.recommendations.forEach((recommendation, index) => {
    ensureBasicPdfSpace(ctx, 56);
    const originLabel = `R${section.sectionDisplayNumber}.${index + 1}`;
    drawBasicPdfParagraph(ctx, `${originLabel} · ${recommendation.questionText}`, {
      size: 9,
      bold: true,
      lineHeight: 13,
    });
    drawBasicPdfParagraph(ctx, recommendation.recommendationText, {
      size: 9,
      color: PORTFOLIO_PDF_MUTED,
      lineHeight: 13,
    });
    drawBasicPdfText(ctx, `Situação: ${recommendation.recommendationStatus}`, {
      size: 8,
      color: PORTFOLIO_PDF_MUTED,
      lineHeight: 11,
    });
    drawBasicPdfSpacer(ctx, 6);
  });
}

function drawAction(
  ctx: BasicPdfTextContext,
  action: RecommendationPortfolioExportActionView,
  actionNumber: number,
  originLabel: string,
): void {
  ensureBasicPdfSpace(ctx, 92);
  drawBasicPdfParagraph(ctx, `A${actionNumber} · ${action.title}`, {
    size: 10,
    bold: true,
    lineHeight: 14,
  });
  drawBasicPdfText(ctx, `Origem: ${originLabel}`, {
    size: 8,
    color: PORTFOLIO_PDF_MUTED,
    lineHeight: 11,
  });
  drawBasicPdfParagraph(ctx, `Responsável: ${action.responsible}`, {
    size: 9,
    lineHeight: 13,
  });
  drawBasicPdfParagraph(
    ctx,
    `Prazo: ${action.startDate} a ${action.endDate} · Progresso: ${action.progress} · Situação: ${action.status}`,
    { size: 9, lineHeight: 13 },
  );
  drawBasicPdfText(ctx, `Última atualização: ${action.updatedAt}`, {
    size: 8,
    color: PORTFOLIO_PDF_MUTED,
    lineHeight: 11,
  });
  drawBasicPdfSpacer(ctx, 5);
  drawBasicPdfDivider(ctx);
  drawBasicPdfSpacer(ctx, 5);
}

function drawSectionActionPlan(
  ctx: BasicPdfTextContext,
  section: RecommendationPortfolioExportSectionView,
): void {
  const summary = sectionActionSummary(section);
  drawBasicPdfText(ctx, "Plano de ação da seção", { size: 11, bold: true });
  drawBasicPdfParagraph(
    ctx,
    `${summary.total} ${summary.total === 1 ? "ação" : "ações"} · ${summary.completed} ${summary.completed === 1 ? "concluída" : "concluídas"}${summary.averageProgress == null ? "" : ` · ${summary.averageProgress}% de execução média`}.`,
    { size: 9, color: PORTFOLIO_PDF_MUTED, lineHeight: 13 },
  );
  drawBasicPdfSpacer(ctx, 6);

  let actionNumber = 0;
  section.recommendations.forEach((recommendation, recommendationIndex) => {
    const originLabel = `R${section.sectionDisplayNumber}.${recommendationIndex + 1}`;
    for (const action of recommendation.actions) {
      actionNumber += 1;
      drawAction(ctx, action, actionNumber, originLabel);
    }
  });
}

function drawPageNumbers(ctx: BasicPdfTextContext): void {
  const pages = ctx.pdf.getPages();
  const total = pages.length;
  const size = 8;
  for (const [index, page] of pages.entries()) {
    const label = latinPdfSafe(`Página ${index + 1} de ${total}`);
    const width = ctx.font.widthOfTextAtSize(label, size);
    page.drawText(label, {
      x: (ctx.pageSize[0] - width) / 2,
      y: 28,
      size,
      font: ctx.font,
      color: rgb(0.45, 0.45, 0.45),
    });
  }
}

/**
 * PDF do plano de ação na hierarquia gerencial:
 * Diagnóstico/Órgão → Eixo → Seção → Plano de ação da seção → Ações.
 * A recomendação continua visível exclusivamente como origem rastreável da ação.
 */
export async function generateActionPlanPdf(
  data: ActionPlanExportData,
): Promise<{ filename: string; content: Uint8Array }> {
  const ctx = await createBasicPdfTextContext();
  const issuedOnLabel = formatPlatformDate(
    data.issuedOn,
    CIVIL_DATE_FORMAT,
    data.issuedOn,
  );

  drawBasicPdfText(ctx, "Plano de ação", { size: 16, bold: true });
  drawBasicPdfSpacer(ctx, 3);
  drawBasicPdfParagraph(
    ctx,
    "Leitura por encadeamento: as ações formam o plano de cada seção; as seções compõem os eixos. As recomendações identificam a origem de cada ação.",
    { size: 9, color: PORTFOLIO_PDF_MUTED, lineHeight: 13 },
  );
  drawBasicPdfDivider(ctx);
  drawBasicPdfSpacer(ctx, PORTFOLIO_PDF_SPACE.afterTitle);

  if (data.document.contexts.length === 0) {
    drawBasicPdfText(ctx, "Nenhuma ação para exportar.", { size: 11 });
  }

  for (const [contextIndex, context] of data.document.contexts.entries()) {
    if (contextIndex > 0) {
      ctx.page = ctx.pdf.addPage([...ctx.pageSize]);
      ctx.y = ctx.topY;
    }
    drawPortfolioContextBlock(ctx, actionPlanPdfContextFields(context, issuedOnLabel));

    for (const axis of context.axes) {
      drawPortfolioAxisBar(ctx, axis.axisName);
      for (const section of axis.sections) {
        drawPortfolioSectionHeading(ctx, section.sectionDisplayNumber, section.sectionName);
        drawRecommendationOrigins(ctx, section);
        drawSectionActionPlan(ctx, section);
        drawBasicPdfSpacer(ctx, PORTFOLIO_PDF_SPACE.afterSection);
      }
      drawBasicPdfSpacer(ctx, PORTFOLIO_PDF_SPACE.afterAxis);
    }
  }

  drawPageNumbers(ctx);
  return {
    filename: `plano-de-acao-${businessToday()}.pdf`,
    content: await ctx.pdf.save(),
  };
}
