import type {
  ReportActionView,
  ReportAxisView,
  ReportDetailedAnalysisView,
  ReportRecommendationView,
  ReportSectionView,
} from "@/features/reports/pdf/report-types";
import {
  prepareDetailedAnalysis,
  REPORT_EMPTY_RECOMMENDATION_ACTIONS,
  REPORT_EMPTY_SECTION_RECOMMENDATIONS,
} from "@/features/reports/pdf/prepare-detailed-analysis";
import { latinPdfSafe } from "@/shared/export/text";
import { formatReportPercentage, formatReportPoints } from "../formatters";
import type { Cursor, OrientaPdfDocument } from "../document";
import { contentWidth, reportTheme } from "../theme";
import { drawRoundedRectFill } from "../helpers";
import {
  drawGridRow,
  headerRow,
  labelValueRow,
  quadRow,
} from "../primitives/bordered-grid";
import { drawReportTable } from "../table";

export function axisAnalysisHeading(axis: ReportAxisView): string {
  return `${axis.numberLabel} - Eixo ${axis.title}`;
}

export function sectionAnalysisHeading(section: ReportSectionView): string {
  return `${section.numberLabel} - ${section.title}`;
}

function dash(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "—";
}

function drawPlainHeading(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  title: string,
): Cursor {
  let cur = { ...cursor, y: cursor.y - 16 };
  cur = doc.ensureSpace(cur, 48);
  cur.page.drawText(latinPdfSafe(title), {
    x: reportTheme.margin,
    y: cur.y,
    size: 13,
    font: doc.fonts.bold,
    color: reportTheme.slate900,
  });
  return { ...cur, y: cur.y - 20 };
}

function renderAxisSummary(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  axis: ReportAxisView,
): Cursor {
  const s = axis.summary;
  const w = contentWidth();
  return drawReportTable(
    doc,
    cursor,
    [
      { key: "indicator", header: "Indicador", width: w * 0.68 },
      { key: "value", header: "Valor", width: w * 0.32, align: "right" },
    ],
    [
      {
        indicator: "Pontuação obtida / máxima aplicável",
        value: formatReportPoints(s.pointsObtained, s.pointsPossible),
      },
      { indicator: "Critérios aplicáveis", value: String(s.applicableCriteriaCount) },
      { indicator: "Seções do eixo", value: String(s.sectionsCount) },
      { indicator: "Seções com plano de ação", value: String(s.sectionsWithActionPlan) },
      { indicator: "Recomendações", value: String(s.recommendationsCount) },
      { indicator: "Ações cadastradas", value: String(s.actionsCount) },
      {
        indicator: "Progresso médio das ações",
        value: s.averageActionProgress == null ? "—" : `${s.averageActionProgress}%`,
      },
    ],
    { zebra: true },
  );
}

function compactPoints(obtained: number | null, possible: number | null): string {
  return formatReportPoints(obtained, possible).replace(/ /g, "");
}

function renderSectionSummaryCard(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  section: ReportSectionView,
): Cursor {
  const s = section.summary;
  const cardH = 64;
  const cur = doc.ensureBlock(cursor, cardH);
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
      label: "Pontuação do critério",
      value: `${compactPoints(s.pointsObtained, s.pointsPossible)} - ${formatReportPercentage(s.percentage, 0)}`,
    },
    { label: "Recomendações", value: String(s.recommendationsCount) },
    { label: "Ações vinculadas", value: String(s.actionsCount) },
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
      x: cx - doc.fonts.regular.widthOfTextAtSize(value, 9) / 2,
      y: midY - 12,
      size: 9,
      font: doc.fonts.regular,
      color: reportTheme.slate900,
    });
  });

  return { page: cur.page, y: bottom - 18 };
}

function latestUpdate(action: ReportActionView): string {
  const last = action.movements[action.movements.length - 1];
  if (!last) return "—";
  return `${last.dateLabel}\n${last.updateText}`;
}

function documentsLabel(action: ReportActionView): string {
  if (action.documents.length === 0) return "";
  return action.documents.map((document) => document.line).join("\n");
}

function renderActionGrid(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  action: ReportActionView,
  index: number,
): Cursor {
  const status =
    action.isOverdue && !action.isCancelled
      ? `${action.statusLabel} · Atrasada`
      : action.statusLabel;
  let cur = labelValueRow(doc, cursor, `Ação ${index + 1}`, action.title);
  cur = quadRow(doc, cur, "Prazo inicial", action.startLabel, "Prazo final", action.endLabel);
  cur = quadRow(
    doc,
    cur,
    "Situação atual",
    status,
    "Progresso",
    `${action.progressPercentage}%`,
  );
  cur = quadRow(
    doc,
    cur,
    "Área responsável",
    action.responsibleSectorLabel,
    "Respondente responsável",
    action.responsibleNameLabel,
  );
  cur = labelValueRow(doc, cur, "Documentos", documentsLabel(action));
  cur = labelValueRow(doc, cur, "Última atualização", latestUpdate(action));
  return cur;
}

function renderRecommendationGrid(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  recommendation: ReportRecommendationView,
  recIndex: number,
): Cursor {
  let cur = doc.ensureSpace(cursor, 80);
  cur = labelValueRow(doc, cur, "Critério", recommendation.originCriterion);
  cur = quadRow(
    doc,
    cur,
    "Resposta",
    dash(recommendation.answerLabel),
    "Resultado da análise",
    dash(recommendation.adminAnalysisLabel),
  );
  cur = labelValueRow(doc, cur, "Fundamentação", dash(recommendation.reasonLabel));
  cur = headerRow(doc, cur, `Recomendação ${recIndex + 1}`);
  cur = drawGridRow(doc, cur, [
    { text: recommendation.recommendationText, width: contentWidth() },
  ]);
  cur = headerRow(doc, cur, "Plano de ação");

  if (recommendation.actions.length === 0) {
    cur = headerRow(doc, cur, REPORT_EMPTY_RECOMMENDATION_ACTIONS);
    return { ...cur, y: cur.y - 16 };
  }

  recommendation.actions.forEach((action, actionIndex) => {
    cur = renderActionGrid(doc, cur, action, actionIndex);
  });
  return { ...cur, y: cur.y - 16 };
}

function renderSection(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  section: ReportSectionView,
): Cursor {
  let cur = drawPlainHeading(doc, cursor, sectionAnalysisHeading(section));
  cur = renderSectionSummaryCard(doc, cur, section);

  if (section.recommendations.length === 0) {
    return doc.drawParagraph(cur, REPORT_EMPTY_SECTION_RECOMMENDATIONS, {
      size: 9,
      color: reportTheme.slate500,
      gap: 8,
    });
  }

  section.recommendations.forEach((recommendation, index) => {
    cur = renderRecommendationGrid(doc, cur, recommendation, index);
  });
  return cur;
}

function renderAxis(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  axis: ReportAxisView,
): Cursor {
  const heading = axisAnalysisHeading(axis);
  doc.registerTocEntry(`axis-${axis.id}`, heading, 1);
  let cur = drawPlainHeading(doc, cursor, heading);
  cur = renderAxisSummary(doc, cur, axis);
  cur = { ...cur, y: cur.y - 8 };

  for (const section of axis.sections) {
    cur = renderSection(doc, cur, section);
  }
  return cur;
}

export function renderDetailedAxisAnalysisSection(
  doc: OrientaPdfDocument,
  analysis?: ReportDetailedAnalysisView,
): Cursor {
  let cur = doc.beginMajorSection(
    "Análise detalhada por eixo",
    undefined,
    "detailed-axis-analysis",
  );

  const view = analysis ?? prepareDetailedAnalysis(doc.data);
  if (view.axes.length === 0) {
    return doc.drawParagraph(
      cur,
      "Não há eixos disponíveis para análise detalhada neste processamento.",
      { size: 10, gap: 8 },
    );
  }

  for (const axis of view.axes) {
    cur = renderAxis(doc, cur, axis);
  }
  return cur;
}
