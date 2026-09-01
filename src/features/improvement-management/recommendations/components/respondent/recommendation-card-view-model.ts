import { actionPlanAvailabilityForCycleState } from "@/features/improvement-management/action-plans/availability";
import type { RespondentRecommendationItem } from "@/features/improvement-management/recommendations/respondent-presentation";
import { formatRecommendationDate } from "@/features/improvement-management/recommendations/components/respondent/respondent-recommendation-row-utils";
import { RECOMMENDATION_REGISTRY, recommendationTypeLabel } from "@/shared/ui/status-registry";
import { respondentActionWorkspacePath } from "@/shared/navigation/respondent-portfolio-paths";

export const RECOMMENDATION_CARD_LABELS = {
  form: "Formulário",
  organization: "Órgão",
  originQuestion: "Pergunta de origem",
  recommendation: "Recomendação",
  situation: "Situação",
  progress: "Progresso",
  reason: "Motivo",
  lastUpdatedPrefix: "Atualizado",
  showSecondary: "Ver informações adicionais",
  hideSecondary: "Ocultar informações adicionais",
  secondaryTitle: "Informações adicionais",
  observations: "Observações",
  /** @deprecated use originQuestion — mantido só para compatibilidade de imports de teste. */
  originCriterion: "Pergunta de origem",
  formVersion: "Versão",
} as const;

export const RECOMMENDATION_PRIMARY_ACTION_LABELS = {
  registerActions: "Cadastrar ações",
  continuePlan: "Continuar plano de integridade e compliance",
  viewActions: "Visualizar ações",
  followActions: "Acompanhar ações",
  followDiagnosis: "Acompanhar diagnóstico",
  consultRecommendation: "Consultar recomendação",
} as const;

export type RecommendationPrimaryAction = {
  label: string;
  href: string;
  variant: "primary" | "secondary";
};

export type RecommendationSecondaryDetails = {
  observations?: string;
  reasonLabel?: string;
};

export type RecommendationCardViewModel = {
  recommendationId: string;
  status: RespondentRecommendationItem["status"];
  /** Nome do eixo estrutural — acento cromático FAMI na lista. */
  axisName: string;
  /** Ex.: "1.1" — número relativo à seção no eixo. */
  recommendationDisplayCode?: string;
  /** Nome do formulário/diagnóstico, sem órgão. */
  formLabel: string;
  /** Versão formatada, quando relevante (ex.: "Versão 1"). */
  formVersionLabel?: string;
  originQuestion: string;
  recommendationText: string;
  actionSummary: string;
  actionCountLabel?: string;
  lastUpdatedLabel?: string;
  lastUpdatedIso?: string;
  progressPercent?: number;
  primaryAction: RecommendationPrimaryAction | null;
  secondaryDetails?: RecommendationSecondaryDetails;
};

function workspaceHref(
  item: RespondentRecommendationItem,
  tab: "visao-geral" | "acoes",
  returnPath: string,
): string {
  return respondentActionWorkspacePath(item.recommendationId, tab, { returnTo: returnPath });
}

function actionCountSummary(item: RespondentRecommendationItem): string {
  if (item.actionCount <= 0) return "Sem ações vinculadas";
  return item.actionCount === 1 ? "1 ação vinculada" : `${item.actionCount} ações vinculadas`;
}

/**
 * Situação operacional única — evita textos contraditórios
 * (ex.: “Sem ações” + “Em andamento”).
 */
export function resolveOperationalSituation(item: RespondentRecommendationItem): string {
  switch (item.status) {
    case "dismissed":
      return "Recomendação dispensada";
    case "completed":
      return "Recomendação concluída";
    case "awaiting_approval":
      return `${actionCountSummary(item)} · aguardando aceite`;
    case "adjustment_requested":
      return `${actionCountSummary(item)} · ${RECOMMENDATION_REGISTRY.adjustment_requested.label}`;
    case "exception_requested":
      return "Exceção em análise";
    case "in_action_plan":
      return `${actionCountSummary(item)} · em elaboração`;
    case "generated":
      break;
  }

  if (!item.hasPlan) {
    if (!item.canCreateActionPlan) {
      return (
        actionPlanAvailabilityForCycleState(item.cycleState)?.title ??
        "Aguardando liberação do plano de integridade e compliance"
      );
    }
    return "Aguardando cadastro de ações";
  }

  return actionCountSummary(item);
}

/**
 * CTA principal centralizado — sem condicionais espalhadas no JSX.
 */
export function resolveRecommendationPrimaryAction(
  item: RespondentRecommendationItem,
  returnPath: string,
): RecommendationPrimaryAction | null {
  if (item.status === "dismissed") {
    return {
      label: RECOMMENDATION_PRIMARY_ACTION_LABELS.consultRecommendation,
      href: workspaceHref(item, "visao-geral", returnPath),
      variant: "secondary",
    };
  }

  if (item.status === "completed") {
    return {
      label: RECOMMENDATION_PRIMARY_ACTION_LABELS.viewActions,
      href: workspaceHref(item, "visao-geral", returnPath),
      variant: "secondary",
    };
  }

  if (item.status === "generated" && !item.hasPlan) {
    if (!item.canCreateActionPlan) {
      return {
        label: RECOMMENDATION_PRIMARY_ACTION_LABELS.followDiagnosis,
        href: `/respondente/ciclos/${encodeURIComponent(item.cycleId)}?returnTo=${encodeURIComponent(returnPath)}`,
        variant: "secondary",
      };
    }
    {
      const actionsHref = workspaceHref(item, "acoes", returnPath);
      return {
        label: RECOMMENDATION_PRIMARY_ACTION_LABELS.registerActions,
        href: actionsHref.includes("?") ? `${actionsHref}&new=1` : `${actionsHref}?new=1`,
        variant: "primary",
      };
    }
  }

  if (item.status === "in_action_plan" || item.status === "adjustment_requested") {
    return {
      label: RECOMMENDATION_PRIMARY_ACTION_LABELS.continuePlan,
      href: workspaceHref(item, "visao-geral", returnPath),
      variant: "primary",
    };
  }

  if (item.status === "awaiting_approval" || item.status === "exception_requested") {
    return {
      label: RECOMMENDATION_PRIMARY_ACTION_LABELS.followActions,
      href: workspaceHref(item, "visao-geral", returnPath),
      variant: "secondary",
    };
  }

  if (item.hasPlan) {
    return {
      label: RECOMMENDATION_PRIMARY_ACTION_LABELS.viewActions,
      href: workspaceHref(item, "visao-geral", returnPath),
      variant: "secondary",
    };
  }

  return null;
}

/** Nome do formulário/diagnóstico, sem concatenar órgão nem duplicar período. */
export function buildFormLabel(item: Pick<RespondentRecommendationItem, "formName" | "periodLabel">): string {
  const name = item.formName.trim();
  const period = item.periodLabel.trim();
  if (!name && !period) return "Diagnóstico";
  if (!name) {
    return period.toLocaleLowerCase("pt-BR").startsWith("diagnóstico")
      ? period
      : `Diagnóstico ${period}`;
  }
  if (!period) return name;

  const normalizedName = name.toLocaleLowerCase("pt-BR");
  const normalizedPeriod = period.toLocaleLowerCase("pt-BR");
  if (normalizedName === normalizedPeriod || normalizedName.includes(normalizedPeriod)) {
    return name;
  }

  // Evita "… 2026 2026.1": se o nome já traz o ano e o período é variação do mesmo ano.
  const periodYear = normalizedPeriod.match(/^(\d{4})\b/)?.[1];
  if (periodYear && normalizedName.includes(periodYear)) {
    if (normalizedPeriod === periodYear) return name;
    return name.replace(new RegExp(`${periodYear}\\s*$`), period);
  }

  return `${name} ${period}`;
}

export function buildFormVersionLabel(formVersion: number): string | undefined {
  return formVersion > 0 ? `Versão ${formVersion}` : undefined;
}

function buildSecondaryDetails(
  item: RespondentRecommendationItem,
): RecommendationSecondaryDetails | undefined {
  const observations = item.plan?.observations?.trim() || undefined;
  const reasonLabel = recommendationTypeLabel(item.recommendationType);
  const details: RecommendationSecondaryDetails = {};
  if (observations) details.observations = observations;
  if (reasonLabel) details.reasonLabel = reasonLabel;
  if (!details.observations && !details.reasonLabel) return undefined;
  // Motivo sozinho não justifica painel expansível — só observações.
  if (!details.observations) return undefined;
  return details;
}

export function toRecommendationCardViewModel(
  item: RespondentRecommendationItem,
  returnPath: string,
  options?: { recommendationDisplayCode?: string },
): RecommendationCardViewModel {
  const updatedIso = item.updatedAt ?? item.createdAt ?? undefined;
  const lastUpdatedLabel = updatedIso ? formatRecommendationDate(updatedIso) : undefined;
  const showProgress = item.hasPlan || item.progress > 0;

  return {
    recommendationId: item.recommendationId,
    status: item.status,
    axisName: item.axisName,
    recommendationDisplayCode: options?.recommendationDisplayCode,
    formLabel: buildFormLabel(item),
    formVersionLabel: buildFormVersionLabel(item.formVersion),
    originQuestion: item.questionPrompt.trim(),
    recommendationText: item.recommendationText,
    actionSummary: resolveOperationalSituation(item),
    actionCountLabel: actionCountSummary(item),
    lastUpdatedLabel: lastUpdatedLabel && lastUpdatedLabel !== "—" ? lastUpdatedLabel : undefined,
    lastUpdatedIso: updatedIso,
    progressPercent: showProgress ? item.progress : 0,
    primaryAction: resolveRecommendationPrimaryAction(item, returnPath),
    secondaryDetails: buildSecondaryDetails(item),
  };
}
