import { structuralAxisOrderIndex } from "@/shared/domain/axis";
import { reportLevelLabel } from "@/features/reports/pdf/build-official-report-data";
import type { ReportFamiSectionScore } from "@/features/reports/pdf/report-types";
import { formatReportPercentage, formatReportPoints } from "../formatters";
import type { Cursor, OrientaPdfDocument } from "../document";
import { contentWidth, reportAxisTheme, reportTheme } from "../theme";
import { drawMiniBarChart, drawProgressBar } from "../helpers";
import { drawReportTable } from "../table";

function sectionsForAxis(
  sections: ReportFamiSectionScore[],
  axisId: string | null,
): ReportFamiSectionScore[] {
  if (axisId == null) return [];
  return sections.filter((section) => section.axisId === axisId);
}

function orderedAxes(doc: OrientaPdfDocument) {
  return [...doc.data.fami.byAxis].sort(
    (a, b) =>
      structuralAxisOrderIndex(a.axisName) - structuralAxisOrderIndex(b.axisName) ||
      a.axisName.localeCompare(b.axisName, "pt-BR"),
  );
}

/**
 * Análise detalhada: desempenho por eixo (gráfico + texto) e tabelas por seção.
 */
export function renderDetailedAnalysisOverviewSection(doc: OrientaPdfDocument): Cursor {
  let cur = doc.beginMajorSection(
    "Análise detalhada",
    "Desempenho do FAMI por eixo e resultado por seção avaliada.",
    "detailed-analysis",
  );

  cur = doc.drawSubsectionTitle(cur, "Desempenho do FAMI por eixo");

  const axes = orderedAxes(doc);
  const applicableAxes = axes.filter((axis) => axis.maturityLevel != null);

  if (applicableAxes.length > 0) {
    cur = doc.ensureBlock(cur, 130);
    cur = drawMiniBarChart(
      doc,
      cur,
      applicableAxes.map((axis) => ({
        label: axis.axisName,
        value: axis.percentage,
        color: reportAxisTheme(axis.axisName).primary,
      })),
      110,
    );
  }

  for (const axis of axes) {
    const value =
      axis.maturityLevel == null
        ? `${axis.axisName} — Sem critérios aplicáveis`
        : `${axis.axisName} — ${formatReportPercentage(axis.percentage)}`;
    cur = doc.drawParagraph(cur, value, {
      size: 10,
      bold: true,
      color: reportAxisTheme(axis.axisName).primary,
      gap: 1,
    });
  }

  const hasAnySection = axes.some(
    (axis) => sectionsForAxis(doc.data.fami.sections, axis.axisId).length > 0,
  );
  if (!hasAnySection) return cur;

  cur = { ...cur, y: cur.y - 8 };
  cur = doc.drawSubsectionTitle(cur, "Desempenho por seção");

  for (const axis of axes) {
    const axisSections = sectionsForAxis(doc.data.fami.sections, axis.axisId);
    if (axisSections.length === 0) continue;

    const theme = reportAxisTheme(axis.axisName);
    cur = doc.ensureSpace(cur, 72);
    cur = doc.drawParagraph(cur, `Eixo ${axis.axisName}`, {
      size: 11,
      bold: true,
      color: theme.primary,
      gap: 2,
    });

    cur = drawReportTable(
      doc,
      cur,
      [
        { key: "order", header: "Ordem", width: contentWidth() * 0.08 },
        { key: "section", header: "Seção", width: contentWidth() * 0.34 },
        { key: "result", header: "Resultado", width: contentWidth() * 0.2 },
        { key: "level", header: "Nível", width: contentWidth() * 0.18 },
        { key: "score", header: "Pontuação", width: contentWidth() * 0.2 },
      ],
      axisSections.map((section, index) => ({
        order: String(index + 1),
        section: section.sectionName,
        result: formatReportPercentage(section.percentage),
        level:
          section.maturityLevel == null
            ? "—"
            : reportLevelLabel(section.maturityLevel),
        score: formatReportPoints(section.pointsObtained, section.pointsPossible),
      })),
    );

    for (const section of axisSections) {
      cur = doc.ensureSpace(cur, 22);
      const label = `${section.sectionName}: ${formatReportPercentage(section.percentage)}`;
      cur.page.drawText(label, {
        x: reportTheme.margin,
        y: cur.y,
        size: 8,
        font: doc.fonts.regular,
        color: reportTheme.slate500,
        maxWidth: contentWidth() * 0.55,
      });
      drawProgressBar(
        cur.page,
        reportTheme.margin + contentWidth() * 0.58,
        cur.y + 4,
        contentWidth() * 0.42,
        section.percentage,
        theme.primary,
      );
      cur = { ...cur, y: cur.y - 16 };
    }
    cur = { ...cur, y: cur.y - 8 };
  }

  return cur;
}
