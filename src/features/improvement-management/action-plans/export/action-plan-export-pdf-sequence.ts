import type {
  RecommendationPortfolioExportActionView,
  RecommendationPortfolioExportSectionView,
} from "@/features/improvement-management/recommendations/export/portfolio-export-types";
import {
  headerRowCells,
  labelValueRowCells,
  noticeRowCells,
  quadRowCells,
  subheaderRowCells,
  type GridCell,
} from "@/shared/export/official-pdf-bordered-grid";

const PLAN_SECTION_HEADING = "Plano de integridade e compliance da seção";
const EMPTY_RECOMMENDATION_ACTIONS = "Nenhuma ação cadastrada para esta recomendação.";

export type RecommendationPlanGrid = {
  rows: GridCell[][];
  spans: number[];
  nextActionNumber: number;
};

function originRows(
  section: RecommendationPortfolioExportSectionView,
  recommendationIndex: number,
): GridCell[][] {
  const recommendation = section.recommendations[recommendationIndex]!;
  const originLabel = `R${section.sectionDisplayNumber}.${recommendationIndex + 1}`;
  return [
    headerRowCells(`Recomendação de origem ${originLabel}`),
    labelValueRowCells("Pergunta", recommendation.questionText),
    ...(recommendation.diagnosticOrigin
      ? [labelValueRowCells("Motivo no diagnóstico", recommendation.diagnosticOrigin)]
      : []),
    labelValueRowCells("Recomendação", recommendation.recommendationText),
    labelValueRowCells("Situação da recomendação", recommendation.recommendationStatus),
  ];
}

function actionRows(
  action: RecommendationPortfolioExportActionView,
  actionNumber: number,
  originLabel: string,
  departure: boolean,
): GridCell[][] {
  return [
    labelValueRowCells(`Ação ${actionNumber}`, action.title),
    labelValueRowCells("Origem", originLabel),
    quadRowCells("Prazo inicial", action.startDate, "Prazo final", action.endDate),
    quadRowCells(
      departure ? "Situação na partida" : "Situação",
      action.status,
      departure ? "Progresso na partida" : "Progresso",
      action.progress,
    ),
    labelValueRowCells("Responsável", action.responsible),
    labelValueRowCells(departure ? "Cadastro da ação" : "Última atualização", action.updatedAt),
  ];
}

/** Uma grade por origem: recomendação, faixa do plano e ações, com quebras entre grupos. */
export function recommendationPlanModel(
  section: RecommendationPortfolioExportSectionView,
  recommendationIndex: number,
  actionNumberStart: number,
  departure: boolean,
): RecommendationPlanGrid {
  const recommendation = section.recommendations[recommendationIndex]!;
  const originLabel = `R${section.sectionDisplayNumber}.${recommendationIndex + 1}`;
  const rows = originRows(section, recommendationIndex);
  const spans = [rows.length];

  if (recommendation.actions.length === 0) {
    rows.push(subheaderRowCells(PLAN_SECTION_HEADING), noticeRowCells(EMPTY_RECOMMENDATION_ACTIONS));
    spans.push(2);
    return { rows, spans, nextActionNumber: actionNumberStart };
  }

  let actionNumber = actionNumberStart;
  recommendation.actions.forEach((action, actionIndex) => {
    actionNumber += 1;
    const block = actionRows(action, actionNumber, originLabel, departure);
    if (actionIndex === 0) {
      rows.push(subheaderRowCells(PLAN_SECTION_HEADING), ...block);
      spans.push(block.length + 1);
      return;
    }
    rows.push(...block);
    spans.push(block.length);
  });
  return { rows, spans, nextActionNumber: actionNumber };
}
