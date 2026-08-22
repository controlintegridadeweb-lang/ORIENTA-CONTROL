import type { FormViewSummary } from "./form-view-types";

export function formatFormViewSummary(summary: FormViewSummary): {
  criteriaLine: string;
  answersLine: string;
  analysisLine: string;
} {
  const criteriaLine = `${summary.totalCriteria} ${summary.totalCriteria === 1 ? "critério" : "critérios"} no formulário`;
  const answersLine = `${summary.answerYes} Sim · ${summary.answerNo} Não · ${summary.answerNotApplicable} Não se aplica`;
  const analysisLine = `${summary.pendingAnalysis} ${summary.pendingAnalysis === 1 ? "pendente de análise" : "pendentes de análise"} · ${summary.analyzed} ${summary.analyzed === 1 ? "analisado" : "analisados"}`;
  return { criteriaLine, answersLine, analysisLine };
}
