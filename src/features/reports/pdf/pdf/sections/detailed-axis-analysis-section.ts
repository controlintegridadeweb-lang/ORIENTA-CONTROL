import type {
  ReportActionView,
  ReportAxisView,
  ReportDetailedAnalysisView,
  ReportRecommendationView,
  ReportSectionView,
} from "@/features/reports/pdf/report-types";
import {
  prepareDetailedAnalysis,
  REPORT_EMPTY_ACTION_DOCUMENTS,
  REPORT_EMPTY_ACTION_MOVEMENTS,
  REPORT_EMPTY_RECOMMENDATION_ACTIONS,
  REPORT_EMPTY_SECTION_RECOMMENDATIONS,
} from "@/features/reports/pdf/prepare-detailed-analysis";
import { formatReportPercentage, formatReportPoints } from "../formatters";
import type { Cursor, OrientaPdfDocument } from "../document";
import { contentWidth, reportAxisTheme, reportTheme } from "../theme";
import { drawBadge, drawProgressBar } from "../helpers";
import { drawReportTable } from "../table";

function drawSummaryTable(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  rows: Array<{ indicator: string; value: string }>,
): Cursor {
  return drawReportTable(
    doc,
    cursor,
    [
      { key: "indicator", header: "Indicador", width: contentWidth() * 0.55 },
      { key: "value", header: "Valor", width: contentWidth() * 0.45 },
    ],
    rows,
  );
}

function renderAxisSummary(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  axis: ReportAxisView,
): Cursor {
  const s = axis.summary;
  return drawSummaryTable(doc, cursor, [
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
  ]);
}

function renderSectionSummary(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  section: ReportSectionView,
): Cursor {
  const s = section.summary;
  const score = formatReportPoints(s.pointsObtained, s.pointsPossible);
  const percentage = formatReportPercentage(s.percentage);
  return doc.drawParagraph(
    cursor,
    `Pontuação: ${score} · ${percentage} · Recomendações: ${s.recommendationsCount} · Ações: ${s.actionsCount}`,
    { size: 8.5, color: reportTheme.slate500, gap: 0 },
  );
}

function renderMovements(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  action: ReportActionView,
): Cursor {
  let cur = doc.drawParagraph(cursor, "Histórico de acompanhamento", {
    size: 8,
    bold: true,
    color: reportTheme.slate500,
    gap: 2,
  });

  if (action.movements.length === 0) {
    return doc.drawParagraph(cur, REPORT_EMPTY_ACTION_MOVEMENTS, {
      size: 8,
      color: reportTheme.slate500,
      gap: 4,
    });
  }

  for (const movement of action.movements) {
    cur = doc.ensureSpace(cur, 48);
    cur = doc.drawParagraph(cur, movement.dateLabel, {
      size: 8,
      bold: true,
      color: reportTheme.slate600,
      gap: 0,
      indent: 8,
    });
    cur = doc.drawParagraph(cur, movement.updateText, {
      size: 8.5,
      color: reportTheme.slate700,
      gap: 0,
      indent: 8,
    });
    cur = doc.drawParagraph(
      cur,
      `Progresso registrado: ${movement.progressLabel} · Responsável: ${movement.responsibleLabel}`,
      { size: 8, color: reportTheme.slate500, gap: 2, indent: 8 },
    );
  }
  return cur;
}

function renderActionBlock(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  action: ReportActionView,
): Cursor {
  let cur = doc.ensureSpace(cursor, 120);
  cur.page.drawRectangle({
    x: reportTheme.margin,
    y: cur.y - 2,
    width: 3,
    height: 14,
    color: reportTheme.brand,
  });
  cur = doc.drawParagraph(cur, `Ação ou compromisso · ${action.numberLabel}`, {
    size: 9,
    bold: true,
    color: reportTheme.slate900,
    gap: 0,
    indent: 10,
  });
  cur = doc.drawParagraph(cur, action.title, {
    size: 9,
    color: reportTheme.slate700,
    gap: 2,
    indent: 10,
  });

  const status =
    action.isOverdue && !action.isCancelled
      ? `${action.statusLabel} · Atrasada`
      : action.statusLabel;
  cur = doc.drawParagraph(cur, `Situação: ${status}`, {
    size: 8.5,
    color: reportTheme.slate600,
    gap: 1,
    indent: 10,
  });

  cur = doc.ensureSpace(cur, 22);
  cur.page.drawText(`Progresso: ${action.progressPercentage}%`, {
    x: reportTheme.margin + 10,
    y: cur.y,
    size: 8.5,
    font: doc.fonts.regular,
    color: reportTheme.slate600,
  });
  drawProgressBar(
    cur.page,
    reportTheme.margin + 120,
    cur.y + 4,
    contentWidth() - 130,
    action.progressPercentage,
  );
  cur = { ...cur, y: cur.y - 16 };

  cur = doc.drawParagraph(
    cur,
    `Prazo — Início: ${action.startLabel} · Conclusão: ${action.endLabel}`,
    { size: 8.5, color: reportTheme.slate600, gap: 1, indent: 10 },
  );
  cur = doc.drawParagraph(cur, `Área responsável: ${action.responsibleSectorLabel}`, {
    size: 8.5,
    color: reportTheme.slate600,
    gap: 1,
    indent: 10,
  });
  cur = doc.drawParagraph(
    cur,
    `Respondente responsável: ${action.responsibleNameLabel}`,
    { size: 8.5, color: reportTheme.slate600, gap: 2, indent: 10 },
  );

  cur = doc.drawParagraph(cur, "Documentos e comprovantes", {
    size: 8,
    bold: true,
    color: reportTheme.slate500,
    gap: 0,
    indent: 10,
  });
  if (action.documents.length === 0) {
    cur = doc.drawParagraph(cur, REPORT_EMPTY_ACTION_DOCUMENTS, {
      size: 8,
      color: reportTheme.slate500,
      gap: 4,
      indent: 10,
    });
  } else {
    for (const document of action.documents) {
      cur = doc.drawParagraph(cur, `- ${document.line}`, {
        size: 8,
        color: reportTheme.slate600,
        gap: 0,
        indent: 10,
      });
    }
    cur = { ...cur, y: cur.y - 6 };
  }

  return renderMovements(doc, cur, action);
}

function normalizedLabel(value: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function hasDistinctFoundation(recommendation: ReportRecommendationView): boolean {
  if (!recommendation.reasonLabel.trim()) return false;
  if (!recommendation.adminAnalysisLabel) return true;
  return (
    normalizedLabel(recommendation.reasonLabel) !==
    normalizedLabel(recommendation.adminAnalysisLabel)
  );
}

function renderRecommendation(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  recommendation: ReportRecommendationView,
): Cursor {
  let cur = doc.ensureSpace(cursor, 140);
  const axisTheme = reportAxisTheme(recommendation.axisName);

  cur.page.drawRectangle({
    x: reportTheme.margin,
    y: cur.y - 28,
    width: contentWidth(),
    height: 32,
    color: axisTheme.softBackground,
    borderColor: axisTheme.border,
    borderWidth: 0.75,
  });
  cur.page.drawRectangle({
    x: reportTheme.margin,
    y: cur.y - 28,
    width: 3,
    height: 32,
    color: axisTheme.primary,
  });
  cur.page.drawText(recommendation.numberLabel, {
    x: reportTheme.margin + 12,
    y: cur.y - 12,
    size: 10,
    font: doc.fonts.bold,
    color: reportTheme.slate900,
  });
  drawBadge(doc, cur.page, reportTheme.margin + 210, cur.y - 10, recommendation.statusLabel, {
    bg: reportTheme.white,
    text: axisTheme.primary,
  });
  cur = { ...cur, y: cur.y - 40 };

  cur = doc.drawParagraph(cur, "Pergunta", {
    size: 8,
    bold: true,
    color: reportTheme.slate500,
    gap: 0,
  });
  cur = doc.drawParagraph(cur, recommendation.originCriterion, {
    size: 9,
    bold: true,
    gap: 0,
  });
  cur = doc.drawParagraph(cur, `Resposta: ${recommendation.answerLabel}`, {
    size: 8,
    color: reportTheme.slate600,
    gap: 0,
  });

  if (recommendation.adminAnalysisLabel) {
    cur = doc.drawParagraph(cur, "Resultado da análise", {
      size: 8,
      bold: true,
      color: reportTheme.slate500,
      gap: 0,
    });
    cur = doc.drawParagraph(cur, recommendation.adminAnalysisLabel, {
      size: 9,
      color: reportTheme.slate700,
      gap: 2,
    });
  }

  if (hasDistinctFoundation(recommendation)) {
    cur = doc.drawParagraph(cur, "Fundamentação", {
      size: 8,
      bold: true,
      color: reportTheme.slate500,
      gap: 0,
    });
    cur = doc.drawParagraph(cur, recommendation.reasonLabel, {
      size: 9,
      color: reportTheme.rose,
      gap: 2,
    });
  }

  cur = doc.drawParagraph(cur, "Recomendação", {
    size: 8,
    bold: true,
    color: reportTheme.slate500,
    gap: 0,
  });
  cur = doc.drawParagraph(cur, recommendation.recommendationText, {
    size: 9,
    gap: 2,
  });

  cur = doc.drawParagraph(cur, `Situação da recomendação: ${recommendation.statusLabel}`, {
    size: 8.5,
    color: reportTheme.slate600,
    gap: 4,
  });

  cur = doc.drawParagraph(cur, "Plano de ação", {
    size: 9,
    bold: true,
    color: reportTheme.slate900,
    gap: 2,
  });

  if (recommendation.actions.length === 0) {
    cur = doc.drawParagraph(cur, REPORT_EMPTY_RECOMMENDATION_ACTIONS, {
      size: 9,
      color: reportTheme.slate500,
      gap: 8,
    });
  } else {
    for (const action of recommendation.actions) {
      cur = renderActionBlock(doc, cur, action);
      cur = { ...cur, y: cur.y - 8 };
    }
  }

  cur = doc.ensureSpace(cur, 12);
  cur.page.drawLine({
    start: { x: reportTheme.margin, y: cur.y },
    end: { x: reportTheme.page.w - reportTheme.margin, y: cur.y },
    thickness: 0.45,
    color: reportTheme.slate200,
  });
  return { ...cur, y: cur.y - 14 };
}

function renderSection(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  section: ReportSectionView,
  axisName: string,
): Cursor {
  let cur = doc.ensureSpace(cursor, 72);
  const axisTheme = reportAxisTheme(axisName);
  cur = doc.drawSubsectionTitle(
    cur,
    `${section.numberLabel} — ${section.title}`,
    undefined,
    { accent: axisTheme.primary },
  );
  cur = renderSectionSummary(doc, cur, section);

  if (section.recommendations.length === 0) {
    return doc.drawParagraph(cur, REPORT_EMPTY_SECTION_RECOMMENDATIONS, {
      size: 9,
      color: reportTheme.slate500,
      gap: 8,
    });
  }

  for (const recommendation of section.recommendations) {
    cur = renderRecommendation(doc, cur, recommendation);
  }
  return cur;
}

function renderAxis(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  axis: ReportAxisView,
): Cursor {
  let cur = doc.ensureSpace(cursor, 90);
  const axisTheme = reportAxisTheme(axis.title);
  doc.registerTocEntry(`axis-${axis.id}`, `${axis.numberLabel} — Eixo ${axis.title}`, 1);
  cur = doc.drawSubsectionTitle(
    cur,
    `${axis.numberLabel} — Eixo ${axis.title}`,
    undefined,
    { accent: axisTheme.primary },
  );
  cur = renderAxisSummary(doc, cur, axis);

  for (const section of axis.sections) {
    cur = renderSection(doc, cur, section, axis.title);
  }
  return cur;
}

export function renderDetailedAxisAnalysisSection(
  doc: OrientaPdfDocument,
  analysis?: ReportDetailedAnalysisView,
): Cursor {
  let cur = doc.beginMajorSection(
    "Análise detalhada por eixo",
    "Hierarquia Eixo -> Seção -> Pergunta -> Recomendação -> Plano de ação -> Monitoramento.",
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
