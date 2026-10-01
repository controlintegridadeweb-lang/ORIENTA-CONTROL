import type { AdminPlanItem } from "@/features/improvement-management/action-plans/admin-monitoring";
import { actionFromAdminPlanItem } from "@/features/improvement-management/action-plans/admin-monitoring";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import type { RespondentRecommendationItem } from "@/features/improvement-management/recommendations/respondent-presentation";
import { buildRecommendationPortfolioExportDocument } from "@/features/improvement-management/recommendations/export/build-portfolio-export-document";
import {
  buildRecommendationPortfolioExportRows,
  toPortfolioExportSourceFromRespondent,
} from "@/features/improvement-management/recommendations/export/build-portfolio-export-rows";
import type { RecommendationPortfolioExportSource } from "@/features/improvement-management/recommendations/export/portfolio-export-types";
import { businessToday } from "@/shared/datetime/business-date";
import { recommendationTypeLabel } from "@/shared/ui/status-registry";
import type { ActionPlanExportData } from "./action-plan-export-types";

/**
 * Converte o item administrativo (1 linha = 1 ação) na fonte compartilhada
 * do portfólio. Sem ação cadastrada → null (o plano de integridade e compliance não exporta
 * recomendações sem execução).
 */
export function toActionPlanExportSourceFromAdmin(
  item: AdminPlanItem,
): RecommendationPortfolioExportSource | null {
  const action = actionFromAdminPlanItem(item);
  if (!action) return null;
  return {
    recommendationId: item.recommendationId,
    formName: item.formName,
    formVersion: item.formVersion,
    periodLabel: item.periodLabel,
    organizationName: item.organizationName,
    axisName: item.axisName,
    sectionName: item.sectionName,
    sectionOrder: item.sectionOrder,
    questionOrder: item.questionOrder,
    questionPrompt: item.questionPrompt,
    recommendationText: item.recommendationText,
    recommendationStatus: item.recommendationStatus,
    plans: [action],
  };
}

export function toActionPlanExportSourceFromRespondent(
  item: RespondentRecommendationItem,
): RecommendationPortfolioExportSource {
  return toPortfolioExportSourceFromRespondent(item);
}

/**
 * Ação na partida: o cadastro nasce sem progresso. Acompanhamento posterior
 * fica nos relatórios de monitoramento, não nesta fotografia.
 */
function projectDepartureAction(plan: ActionPlanAction): ActionPlanAction {
  return {
    ...plan,
    progressPercentage: 0,
    status: "not_started",
    observations: null,
    updatedAt: plan.createdAt?.trim() ? plan.createdAt : "",
  };
}

/** Partida do plano: origem do diagnóstico e ações como foram cadastradas. */
export function toDepartureActionPlanSourceFromRespondent(
  item: RespondentRecommendationItem,
): RecommendationPortfolioExportSource {
  return {
    ...toActionPlanExportSourceFromRespondent(item),
    diagnosticOrigin: recommendationTypeLabel(item.recommendationType),
    plans: item.plans.map(projectDepartureAction),
  };
}

/** Mesma partida, a partir da linha de monitoramento do administrador. */
export function toDepartureActionPlanSourceFromAdmin(
  item: AdminPlanItem,
): RecommendationPortfolioExportSource | null {
  const source = toActionPlanExportSourceFromAdmin(item);
  if (!source) return null;
  return {
    ...source,
    diagnosticOrigin: recommendationTypeLabel(item.recommendationType),
    plans: source.plans.map(projectDepartureAction),
  };
}

/**
 * Monta o DTO único da exportação. Filtra recomendações sem ações,
 * reutiliza ordenação/labels/progresso do portfólio e não inventa histórico.
 */
export function getActionPlanExportData(
  sources: readonly RecommendationPortfolioExportSource[],
  issuedOn: string = businessToday(),
): ActionPlanExportData {
  const withActions = sources.filter((source) => source.plans.length > 0);
  const rows = buildRecommendationPortfolioExportRows(withActions).filter(
    (row) => row.sort.actionId != null,
  );
  return {
    sources: withActions,
    rows,
    document: buildRecommendationPortfolioExportDocument(rows),
    issuedOn,
  };
}
