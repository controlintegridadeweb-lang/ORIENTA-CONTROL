import type {
  ReportActionView,
  ReportAxisView,
  ReportDetailedAnalysisView,
  ReportRecommendationView,
  ReportSectionView,
} from "@/features/reports/pdf/report-types";
import {
  prepareDetailedAnalysis,
  REPORT_EMPTY_ACTION_MOVEMENTS,
  REPORT_EMPTY_SECTION_ACTIONS,
  REPORT_EMPTY_SECTION_RECOMMENDATIONS,
} from "@/features/reports/pdf/prepare-detailed-analysis";
import type { Cursor, OrientaPdfDocument } from "../document";
import { contentWidth, reportAxisTheme, reportTheme } from "../theme";
import { drawBadge } from "../helpers";
import { drawReportTable } from "../table";

function formatPoints(obtained: number | null, possible: number | null): string {
  if (obtained == null || possible == null) return "-";
  return `${obtained.toFixed(2)} / ${possible.toFixed(2)}`;
}

function formatPercentage(value: number | null): string {
  if (value == null) return "-";
  return `${value.toFixed(1)}%`;
}

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
      value: formatPoints(s.pointsObtained, s.pointsPossible),
    },
    { indicator: "Critérios aplicáveis", value: String(s.applicableCriteriaCount) },
    { indicator: "Seções do eixo", value: String(s.sectionsCount) },
    { indicator: "Seções com plano de ação", value: String(s.sectionsWithActionPlan) },
    { indicator: "Recomendações", value: String(s.recommendationsCount) },
    { indicator: "Ações cadastradas", value: String(s.actionsCount) },
    {
      indicator: "Progresso médio das ações",
      value: s.averageActionProgress == null ? "-" : `${s.averageActionProgress}%`,
    },
  ]);
}

/**
 * A seção é um nível de navegação, não um novo painel executivo.
 * Mantém apenas os três dados que ajudam o leitor a decidir se deve aprofundar.
 */
function renderSectionSummary(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  section: ReportSectionView,
): Cursor {
  const s = section.summary;
  const score = formatPoints(s.pointsObtained, s.pointsPossible);
  const percentage = formatPercentage(s.percentage);
  return doc.drawParagraph(
    cursor,
    `Pontuação: ${score}${percentage === "-" ? "" : ` (${percentage})`} · Recomendações: ${s.recommendationsCount} · Ações: ${s.actionsCount}.`,
    { size: 8, color: reportTheme.slate500, gap: 0 },
  );
}

function renderMovements(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  action: ReportActionView,
): Cursor {
  const cur = doc.drawParagraph(cursor, `Histórico da ação · ${action.numberLabel}`, {
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

  return drawReportTable(
    doc,
    cur,
    [
      { key: "date", header: "Data", width: contentWidth() * 0.16 },
      { key: "progress", header: "Evolução", width: contentWidth() * 0.18 },
      { key: "update", header: "Atualização", width: contentWidth() * 0.44 },
      { key: "responsible", header: "Responsável", width: contentWidth() * 0.22 },
    ],
    action.movements.map((movement) => ({
      date: movement.dateLabel,
      progress: movement.progressLabel,
      update: movement.updateText,
      responsible: movement.responsibleLabel,
    })),
  );
}

function renderSectionActionPlan(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  section: ReportSectionView,
): Cursor {
  const plan = section.actionPlan;
  let cur = doc.ensureSpace(cursor, 100);
  cur = doc.drawParagraph(cur, "Plano de ação da seção", {
    size: 10,
    bold: true,
    color: reportTheme.slate900,
    gap: 1,
  });
  cur = doc.drawParagraph(
    cur,
    `${plan.summary.statusLabel} · ${plan.summary.totalActions} ações · ${plan.summary.completedActions} concluídas · ${plan.summary.overdueActions} em atraso · ${plan.summary.progressPercentage}% de execução.`,
    { size: 8, color: reportTheme.slate500, gap: 4 },
  );

  if (plan.actions.length === 0) {
    return doc.drawParagraph(cur, REPORT_EMPTY_SECTION_ACTIONS, {
      size: 9,
      color: reportTheme.slate500,
      gap: 6,
    });
  }

  cur = drawReportTable(
    doc,
    cur,
    [
      { key: "action", header: "Ação", width: contentWidth() * 0.25 },
      { key: "origin", header: "Origem", width: contentWidth() * 0.18 },
      { key: "responsible", header: "Responsável", width: contentWidth() * 0.17 },
      { key: "end", header: "Final", width: contentWidth() * 0.11 },
      { key: "progress", header: "Progresso", width: contentWidth() * 0.11 },
      { key: "status", header: "Situação", width: contentWidth() * 0.18 },
    ],
    plan.actions.map((action) => ({
      action: `${action.numberLabel} · ${action.title}`,
      origin: action.originRecommendationNumberLabel,
      responsible: action.responsibleLabel,
      end: action.endLabel,
      progress: `${action.progressPercentage}%`,
      status: action.isOverdue ? `${action.statusLabel} · Atrasada` : action.statusLabel,
    })),
  );

  for (const action of plan.actions) {
    cur = doc.drawParagraph(
      cur,
      `Origem de ${action.numberLabel}: ${action.originRecommendationNumberLabel} · ${action.originRecommendationText}`,
      { size: 7.5, color: reportTheme.slate500, gap: 1 },
    );
    cur = renderMovements(doc, cur, action);
  }
  return cur;
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
  return normalizedLabel(recommendation.reasonLabel) !== normalizedLabel(recommendation.adminAnalysisLabel);
}

function renderRecommendation(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  recommendation: ReportRecommendationView,
): Cursor {
  let cur = doc.ensureSpace(cursor, 120);
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
    bg: axisTheme.softBackground,
    text: axisTheme.primary,
  });
  cur = { ...cur, y: cur.y - 40 };

  // Eixo e seção já estão expressos nos cabeçalhos hierárquicos; não são repetidos aqui.
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
    gap: 4,
  });

  // A situação agregada já é exibida uma única vez no badge do cabeçalho.
  // As ações são consolidadas uma única vez no Plano de ação da seção.
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
    `${section.numberLabel} - ${section.title}`,
    undefined,
    { accent: axisTheme.primary },
  );
  cur = renderSectionSummary(doc, cur, section);

  cur = doc.drawParagraph(cur, "Recomendações que originaram intervenções", {
    size: 9,
    bold: true,
    color: reportTheme.slate700,
    gap: 3,
  });
  if (section.recommendations.length === 0) {
    cur = doc.drawParagraph(cur, REPORT_EMPTY_SECTION_RECOMMENDATIONS, {
      size: 9,
      color: reportTheme.slate500,
      gap: 8,
    });
  } else {
    for (const recommendation of section.recommendations) {
      cur = renderRecommendation(doc, cur, recommendation);
    }
  }

  return renderSectionActionPlan(doc, cur, section);
}

function renderAxis(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  axis: ReportAxisView,
): Cursor {
  let cur = doc.ensureSpace(cursor, 90);
  const axisTheme = reportAxisTheme(axis.title);
  doc.registerTocEntry(`axis-${axis.id}`, `${axis.numberLabel} - ${axis.title}`, 1);
  cur = doc.drawSubsectionTitle(
    cur,
    `${axis.numberLabel} - Eixo ${axis.title}`,
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
