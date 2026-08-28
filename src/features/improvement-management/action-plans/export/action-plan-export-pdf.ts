import { PDFDocument, StandardFonts, type PDFPage, type RGB } from "pdf-lib";
import { businessToday } from "@/shared/datetime/business-date";
import { formatPlatformDate } from "@/shared/datetime/platform-date-time";
import { latinPdfSafe } from "@/shared/export/text";
import { drawRoundedRect } from "@/shared/export/pdf-rounded-rect";
import type {
  RecommendationPortfolioExportActionView,
  RecommendationPortfolioExportContextView,
  RecommendationPortfolioExportSectionView,
} from "@/features/improvement-management/recommendations/export/portfolio-export-types";
import {
  drawGridBlock,
  headerRowCells,
  labelValueRowCells,
  quadRowCells,
} from "@/shared/export/official-pdf-bordered-grid";
import {
  contentWidth,
  reportAxisTheme,
  reportTheme,
} from "@/shared/export/official-pdf-theme";
import type { Cursor, PdfGridHost, ReportFonts } from "@/shared/export/official-pdf-types";
import { drawRoundedRectFill } from "@/shared/export/pdf-rounded-rect";
import type { ActionPlanExportData } from "./action-plan-export-types";

const CIVIL_DATE_FORMAT = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
} as const;

/** Documento de conteúdo com a mesma gramática visual do relatório oficial. */
class ActionPlanPdfDocument implements PdfGridHost {
  readonly pdf: PDFDocument;
  readonly fonts: ReportFonts;
  private pageIndex = -1;

  private constructor(pdf: PDFDocument, fonts: ReportFonts) {
    this.pdf = pdf;
    this.fonts = fonts;
  }

  static async create(): Promise<ActionPlanPdfDocument> {
    const pdf = await PDFDocument.create();
    const fonts: ReportFonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold: await pdf.embedFont(StandardFonts.HelveticaBold),
      italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
    };
    return new ActionPlanPdfDocument(pdf, fonts);
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

  ensureSpace(c: Cursor, needed: number): Cursor {
    if (c.y - needed < this.contentBottom) return this.newPage();
    return c;
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
      color?: RGB;
      gap?: number;
    } = {},
  ): Cursor {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.fonts.bold : this.fonts.regular;
    const color = opts.color ?? reportTheme.slate700;
    const gap = opts.gap ?? 0;
    const usable = contentWidth();
    const maxChars = Math.floor(usable / (size * 0.52));
    let cur = { ...c, y: c.y - gap };
    for (const line of this.chunkText(text, maxChars)) {
      cur = this.ensureSpace(cur, reportTheme.line);
      cur.page.drawText(line, {
        x: reportTheme.margin,
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

  drawSectionTitle(c: Cursor, title: string, subtitle?: string): Cursor {
    const cur = c;
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

  drawSubsectionTitle(c: Cursor, title: string): Cursor {
    let cur = this.ensureSpace(c, 48);
    cur.page.drawText(latinPdfSafe(title), {
      x: reportTheme.margin,
      y: cur.y,
      size: 12,
      font: this.fonts.bold,
      color: reportTheme.brandDark,
    });
    cur = { ...cur, y: cur.y - 18 };
    cur.page.drawRectangle({
      x: reportTheme.margin,
      y: cur.y - 4,
      width: 56,
      height: 2,
      color: reportTheme.brand,
    });
    return { ...cur, y: cur.y - 16 };
  }

  drawPlainHeading(c: Cursor, title: string): Cursor {
    let cur = { ...c, y: c.y - 8 };
    cur = this.ensureSpace(cur, 40);
    cur.page.drawText(latinPdfSafe(title), {
      x: reportTheme.margin,
      y: cur.y,
      size: 13,
      font: this.fonts.bold,
      color: reportTheme.slate900,
    });
    return { ...cur, y: cur.y - 18 };
  }

  applyFooters(): void {
    const pages = this.pdf.getPages();
    const total = pages.length;
    pages.forEach((page, i) => {
      drawContentFooter(this.fonts, page, i + 1, total);
    });
  }
}

function drawContentFooter(
  fonts: ReportFonts,
  page: PDFPage,
  pageNum: number,
  totalPages: number,
): void {
  const y = 22;
  const label = latinPdfSafe(`Página ${pageNum} de ${totalPages}`);
  page.drawLine({
    start: { x: reportTheme.margin, y: y + 12 },
    end: { x: reportTheme.page.w - reportTheme.margin, y: y + 12 },
    thickness: 0.4,
    color: reportTheme.slate200,
  });
  const labelW = fonts.regular.widthOfTextAtSize(label, 8);
  page.drawText(label, {
    x: (reportTheme.page.w - labelW) / 2,
    y,
    size: 8,
    font: fonts.regular,
    color: reportTheme.slate500,
  });
}

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

function drawContextBlock(
  doc: ActionPlanPdfDocument,
  cursor: Cursor,
  context: RecommendationPortfolioExportContextView,
  issuedOnLabel: string,
): Cursor {
  const titled = doc.drawSubsectionTitle(cursor, "Contexto");
  const cur = drawGridBlock(doc, titled, [
    quadRowCells("Formulário", context.formName, "Órgão", context.organizationName),
    quadRowCells("Ciclo", context.period, "Data de emissão", issuedOnLabel),
  ]);
  return { ...cur, y: cur.y - 16 };
}

function drawAxisBar(doc: ActionPlanPdfDocument, cursor: Cursor, axisName: string): Cursor {
  const width = contentWidth();
  const size = 11;
  const label = latinPdfSafe(`Eixo - ${axisName}`);
  const textW = doc.fonts.bold.widthOfTextAtSize(label, size);
  const height = 28;
  const cur = doc.ensureSpace(cursor, height + 16);
  const bottom = cur.y - height;
  const axis = reportAxisTheme(axisName);
  drawRoundedRect(cur.page, {
    x: reportTheme.margin,
    y: bottom,
    width,
    height,
    radius: 5,
    color: axis.strong,
  });
  cur.page.drawText(label, {
    x: reportTheme.margin + (width - textW) / 2,
    y: bottom + (height - size) / 2 + 1,
    size,
    font: doc.fonts.bold,
    color: reportTheme.white,
  });
  return { ...cur, y: bottom - 16 };
}

function drawSummaryCard(
  doc: ActionPlanPdfDocument,
  cursor: Cursor,
  summary: ReturnType<typeof sectionActionSummary>,
): Cursor {
  const cardH = 64;
  const cur = doc.ensureSpace(cursor, cardH + 18);
  const w = contentWidth();
  const bottom = cur.y - cardH;
  drawRoundedRectFill(
    cur.page,
    reportTheme.margin,
    bottom,
    w,
    cardH,
    8,
    reportTheme.sectionSummaryCard,
  );

  const cols = [
    {
      label: "Ações da seção",
      value: String(summary.total),
    },
    {
      label: "Concluídas",
      value: String(summary.completed),
    },
    {
      label: "Execução média",
      value: summary.averageProgress == null ? "—" : `${summary.averageProgress}%`,
    },
  ];
  const colW = w / 3;
  const midY = bottom + cardH / 2;
  cols.forEach((col, index) => {
    const cx = reportTheme.margin + colW * index + colW / 2;
    const label = latinPdfSafe(col.label);
    const value = latinPdfSafe(col.value);
    cur.page.drawText(label, {
      x: cx - doc.fonts.bold.widthOfTextAtSize(label, 8) / 2,
      y: midY + 8,
      size: 8,
      font: doc.fonts.bold,
      color: reportTheme.slate900,
    });
    cur.page.drawText(value, {
      x: cx - doc.fonts.regular.widthOfTextAtSize(value, 11) / 2,
      y: midY - 12,
      size: 11,
      font: doc.fonts.regular,
      color: reportTheme.slate900,
    });
  });

  return { page: cur.page, y: bottom - 18 };
}

function drawRecommendationOrigin(
  doc: ActionPlanPdfDocument,
  cursor: Cursor,
  section: RecommendationPortfolioExportSectionView,
  recommendationIndex: number,
): Cursor {
  const recommendation = section.recommendations[recommendationIndex]!;
  const originLabel = `R${section.sectionDisplayNumber}.${recommendationIndex + 1}`;
  const cur = drawGridBlock(doc, cursor, [
    headerRowCells(`Recomendação de origem ${originLabel}`),
    labelValueRowCells("Pergunta", recommendation.questionText),
    labelValueRowCells("Recomendação", recommendation.recommendationText),
    labelValueRowCells("Situação da recomendação", recommendation.recommendationStatus),
  ]);
  return { ...cur, y: cur.y - 12 };
}

function drawActionGrid(
  doc: ActionPlanPdfDocument,
  cursor: Cursor,
  action: RecommendationPortfolioExportActionView,
  actionNumber: number,
  originLabel: string,
): Cursor {
  const cur = drawGridBlock(doc, cursor, [
    labelValueRowCells(`Ação ${actionNumber}`, action.title),
    labelValueRowCells("Origem", originLabel),
    quadRowCells("Prazo inicial", action.startDate, "Prazo final", action.endDate),
    quadRowCells("Situação", action.status, "Progresso", action.progress),
    labelValueRowCells("Responsável", action.responsible),
    labelValueRowCells("Última atualização", action.updatedAt),
  ]);
  return { ...cur, y: cur.y - 12 };
}

function drawSection(
  doc: ActionPlanPdfDocument,
  cursor: Cursor,
  section: RecommendationPortfolioExportSectionView,
): Cursor {
  let cur = doc.drawPlainHeading(
    cursor,
    `Seção ${section.sectionDisplayNumber} - ${section.sectionName}`,
  );
  const summary = sectionActionSummary(section);
  cur = drawSummaryCard(doc, cur, summary);

  cur = doc.drawSubsectionTitle(cur, "Recomendações de origem");
  section.recommendations.forEach((_, index) => {
    cur = drawRecommendationOrigin(doc, cur, section, index);
  });

  cur = doc.drawSubsectionTitle(cur, "Plano de ação da seção");
  if (summary.total === 0) {
    return doc.drawParagraph(cur, "Nenhuma ação cadastrada nesta seção.", {
      size: 9,
      color: reportTheme.slate500,
    });
  }

  let actionNumber = 0;
  section.recommendations.forEach((recommendation, recommendationIndex) => {
    const originLabel = `R${section.sectionDisplayNumber}.${recommendationIndex + 1}`;
    for (const action of recommendation.actions) {
      actionNumber += 1;
      cur = drawActionGrid(doc, cur, action, actionNumber, originLabel);
    }
  });
  return { ...cur, y: cur.y - 8 };
}

/**
 * PDF do plano de ação com a identidade visual do relatório oficial:
 * título com barra institucional, contexto em grade, eixo colorido,
 * card de resumo da seção e ações/recomendações em grade bordada.
 */
export async function generateActionPlanPdf(
  data: ActionPlanExportData,
): Promise<{ filename: string; content: Uint8Array }> {
  const doc = await ActionPlanPdfDocument.create();
  const issuedOnLabel = formatPlatformDate(
    data.issuedOn,
    CIVIL_DATE_FORMAT,
    data.issuedOn,
  );

  let cur = doc.newPage();
  cur = doc.drawSectionTitle(
    cur,
    "Plano de ação",
    "Leitura por encadeamento: as ações formam o plano de cada seção; as seções compõem os eixos. As recomendações identificam a origem de cada ação.",
  );

  if (data.document.contexts.length === 0) {
    cur = doc.drawParagraph(cur, "Nenhuma ação para exportar.", { size: 11 });
  }

  for (const [contextIndex, context] of data.document.contexts.entries()) {
    if (contextIndex > 0) {
      cur = doc.newPage();
      cur = doc.drawSectionTitle(cur, "Plano de ação");
    }
    cur = drawContextBlock(doc, cur, context, issuedOnLabel);

    for (const axis of context.axes) {
      cur = drawAxisBar(doc, cur, axis.axisName);
      for (const section of axis.sections) {
        cur = drawSection(doc, cur, section);
      }
      cur = { ...cur, y: cur.y - 10 };
    }
  }

  doc.applyFooters();
  return {
    filename: `plano-de-acao-${businessToday()}.pdf`,
    content: await doc.pdf.save(),
  };
}
