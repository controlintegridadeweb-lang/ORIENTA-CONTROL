import { rgb } from "pdf-lib";
import { businessToday } from "@/shared/datetime/business-date";
import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import {
  createBasicPdfTextContext,
  drawBasicPdfDivider,
  drawBasicPdfSpacer,
  drawBasicPdfText,
  type BasicPdfTextContext,
} from "@/shared/export/basic-pdf-text";
import { latinPdfSafe } from "@/shared/export/text";
import { buildRecommendationPortfolioExportDocument } from "./build-portfolio-export-document";
import {
  drawRecommendationCard,
  type InstitutionalPdfCardOptions,
} from "./portfolio-export-pdf-card";
import type {
  RecommendationPortfolioExportContextView,
  RecommendationPortfolioExportDocument,
  RecommendationPortfolioExportRow,
} from "./portfolio-export-types";
import {
  drawPortfolioAxisBar,
  drawPortfolioContextBlock,
  drawPortfolioSectionHeading,
  portfolioPdfContextFields,
  PORTFOLIO_PDF_MUTED,
  PORTFOLIO_PDF_SPACE,
  type PdfContextFields,
} from "./portfolio-export-pdf-layout";

export type InstitutionalHierarchyPdfOptions = {
  title: string;
  filenameBase: string;
  emptyMessage: string;
  showGeneratedAt?: boolean;
  card?: InstitutionalPdfCardOptions;
  contextFields: (context: RecommendationPortfolioExportContextView) => PdfContextFields;
};

function drawTitle(
  ctx: BasicPdfTextContext,
  title: string,
  showGeneratedAt: boolean,
): void {
  drawBasicPdfText(ctx, title, { size: 16, bold: true });
  drawBasicPdfSpacer(ctx, 4);
  if (showGeneratedAt) {
    drawBasicPdfText(ctx, `Gerado em: ${formatPlatformDateTime(new Date().toISOString())}`, {
      size: 9,
      color: PORTFOLIO_PDF_MUTED,
    });
    drawBasicPdfSpacer(ctx, 6);
  }
  drawBasicPdfDivider(ctx);
  drawBasicPdfSpacer(ctx, PORTFOLIO_PDF_SPACE.afterTitle);
}

function drawDocument(
  ctx: BasicPdfTextContext,
  document: RecommendationPortfolioExportDocument,
  options: InstitutionalHierarchyPdfOptions,
): void {
  if (document.contexts.length === 0) {
    drawBasicPdfText(ctx, options.emptyMessage, { size: 11 });
    return;
  }

  for (const [contextIndex, context] of document.contexts.entries()) {
    if (contextIndex > 0) {
      ctx.page = ctx.pdf.addPage([...ctx.pageSize]);
      ctx.y = ctx.topY;
    }
    drawPortfolioContextBlock(ctx, options.contextFields(context));

    for (const axis of context.axes) {
      drawPortfolioAxisBar(ctx, axis.axisName);
      for (const section of axis.sections) {
        drawPortfolioSectionHeading(ctx, section.sectionDisplayNumber, section.sectionName);
        for (const recommendation of section.recommendations) {
          drawRecommendationCard(ctx, recommendation, axis.axisName, options.card);
        }
      }
      drawBasicPdfSpacer(ctx, PORTFOLIO_PDF_SPACE.afterAxis);
    }
  }
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
 * PDF institucional hierárquico. O renderer só desenha o ViewModel.
 * Hierarquia, labels, datas e progresso vêm de `buildRecommendationPortfolioExportDocument`.
 */
export async function buildInstitutionalHierarchyPdf(
  rows: readonly RecommendationPortfolioExportRow[],
  options: InstitutionalHierarchyPdfOptions,
): Promise<{ filename: string; content: Uint8Array }> {
  const ctx = await createBasicPdfTextContext();
  drawTitle(ctx, options.title, options.showGeneratedAt !== false);
  drawDocument(ctx, buildRecommendationPortfolioExportDocument(rows), options);
  drawPageNumbers(ctx);

  return {
    filename: `${options.filenameBase}-${businessToday()}.pdf`,
    content: await ctx.pdf.save(),
  };
}

export async function buildRecommendationPortfolioPdf(
  rows: readonly RecommendationPortfolioExportRow[],
): Promise<{ filename: string; content: Uint8Array }> {
  return buildInstitutionalHierarchyPdf(rows, {
    title: "Portfólio de recomendações",
    filenameBase: "portfolio-recomendacoes",
    emptyMessage: "Nenhuma recomendação para exportar.",
    contextFields: portfolioPdfContextFields,
  });
}
