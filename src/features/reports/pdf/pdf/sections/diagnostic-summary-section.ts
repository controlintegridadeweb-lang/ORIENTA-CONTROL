import type { OfficialReportData } from "@/features/reports/pdf/report-types";
import { prepareDetailedAnalysis } from "@/features/reports/pdf/prepare-detailed-analysis";
import { formatReportInteger } from "../formatters";
import type { Cursor, OrientaPdfDocument } from "../document";
import { contentWidth } from "../theme";
import { drawReportTable } from "../table";

export type DiagnosticSummaryMetrics = {
  evaluatedQuestions: number;
  totalRecommendations: number;
  evaluatedSections: number;
  sectionsWithRecommendations: number;
};

/**
 * Métricas do resumo do diagnóstico — derivadas do DTO consolidado (sem nova regra).
 */
export function buildDiagnosticSummaryMetrics(
  data: OfficialReportData,
): DiagnosticSummaryMetrics {
  const sectionIds = new Set(
    data.diagnostic.criteria
      .filter((criterion) => criterion.result !== "waived")
      .map((criterion) => criterion.sectionId),
  );
  const analysis = prepareDetailedAnalysis(data);
  const sectionsWithRecommendations = analysis.axes.reduce(
    (total, axis) =>
      total +
      axis.sections.filter((section) => section.summary.recommendationsCount > 0).length,
    0,
  );

  return {
    evaluatedQuestions: data.diagnostic.summary.evaluated,
    totalRecommendations: data.actionPlan.summary.totalRecommendations,
    evaluatedSections: sectionIds.size,
    sectionsWithRecommendations,
  };
}

export const DIAGNOSTIC_SUMMARY_INDICATORS = {
  evaluatedQuestions: "Total de perguntas avaliadas",
  totalRecommendations: "Total de recomendações identificadas",
  evaluatedSections: "Total de seções avaliadas",
  sectionsWithRecommendations: "Seções que tiveram recomendações",
} as const;

export function renderDiagnosticSummarySection(doc: OrientaPdfDocument): Cursor {
  let cur = doc.beginMajorSection(
    "Resumo do diagnóstico",
    "Indicadores consolidados do ciclo selecionado.",
    "diagnostic-summary",
  );

  const metrics = buildDiagnosticSummaryMetrics(doc.data);
  cur = drawReportTable(
    doc,
    cur,
    [
      { key: "indicator", header: "Indicador", width: contentWidth() * 0.62 },
      { key: "result", header: "Resultado", width: contentWidth() * 0.38 },
    ],
    [
      {
        indicator: DIAGNOSTIC_SUMMARY_INDICATORS.evaluatedQuestions,
        result: formatReportInteger(metrics.evaluatedQuestions),
      },
      {
        indicator: DIAGNOSTIC_SUMMARY_INDICATORS.totalRecommendations,
        result: formatReportInteger(metrics.totalRecommendations),
      },
      {
        indicator: DIAGNOSTIC_SUMMARY_INDICATORS.evaluatedSections,
        result: formatReportInteger(metrics.evaluatedSections),
      },
      {
        indicator: DIAGNOSTIC_SUMMARY_INDICATORS.sectionsWithRecommendations,
        result: formatReportInteger(metrics.sectionsWithRecommendations),
      },
    ],
  );

  return cur;
}
