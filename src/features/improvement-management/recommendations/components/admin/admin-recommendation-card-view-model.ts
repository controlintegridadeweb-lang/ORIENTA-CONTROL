import type { AdminRecommendationItem } from "@/features/improvement-management/recommendations/admin-presentation";
import { STATUS_META } from "@/features/improvement-management/recommendations/admin-presentation";
import {
  buildFormLabel,
  buildFormVersionLabel,
} from "@/features/improvement-management/recommendations/components/respondent/recommendation-card-view-model";
import {
  adminPlanoAcaoDetailHref,
  adminRecomendacoesHref,
} from "@/shared/navigation/admin-paths";
import { withAdminReturnPath } from "@/shared/navigation/admin-navigation-context";

export const ADMIN_RECOMMENDATION_CARD_LABELS = {
  form: "Formulário",
  organization: "Órgão",
  originQuestion: "Pergunta de origem",
  recommendation: "Recomendação",
  situation: "Situação",
  progress: "Progresso",
  detail: "Detalhe",
  actionPlan: "Plano de integridade e compliance",
} as const;

export type AdminRecommendationCardViewModel = {
  recommendationId: string;
  recommendationDisplayCode: string;
  formLabel: string;
  formVersionLabel?: string;
  organizationName: string | null;
  originQuestion: string;
  recommendationText: string;
  situationLabel: string;
  actionCountLabel: string;
  progress: number;
  isOverdue: boolean;
  detailHref: string;
  actionPlanHref: string;
};

function actionCountLabel(planCount: number): string {
  if (planCount <= 0) return "Sem ações vinculadas";
  if (planCount === 1) return "1 ação vinculada";
  return `${planCount} ações vinculadas`;
}

export function toAdminRecommendationCardViewModel(
  item: AdminRecommendationItem,
  recommendationDisplayCode: string,
  options: {
    returnTo: string;
    showOrganization: boolean;
  },
): AdminRecommendationCardViewModel {
  return {
    recommendationId: item.recommendationId,
    recommendationDisplayCode,
    formLabel: buildFormLabel({
      formName: item.formName,
      periodLabel: item.periodLabel,
    }),
    formVersionLabel: buildFormVersionLabel(item.formVersion),
    organizationName: options.showOrganization ? item.organizationName : null,
    originQuestion: item.questionPrompt.trim(),
    recommendationText: item.recommendationText.trim(),
    situationLabel: STATUS_META[item.recommendationStatus].label,
    actionCountLabel: actionCountLabel(item.plans.length),
    progress: item.progress,
    isOverdue: item.isOverdue,
    detailHref: withAdminReturnPath(
      adminRecomendacoesHref(item.recommendationId),
      options.returnTo,
    ),
    actionPlanHref: withAdminReturnPath(
      adminPlanoAcaoDetailHref(item.recommendationId, "visao-geral"),
      options.returnTo,
    ),
  };
}
