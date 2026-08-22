"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";
import { withRespondentReturnPath } from "@/shared/navigation/respondent-navigation-context";
import { withAdminReturnPath } from "@/shared/navigation/admin-navigation-context";
import { useRecommendationDetailContext } from "./recommendation-detail-context";
import {
  OverviewBlockTitle,
  OverviewSoftPanel,
  RecommendationCardField,
  RecommendationCardText,
  overviewStack,
} from "./overview-section-primitives";
import { RECOMMENDATION_CARD_LABELS } from "@/features/improvement-management/recommendations/components/respondent/recommendation-card-view-model";

type Props = {
  actionCount: number;
  axisName: string;
  highlightActionText?: string | null;
};

function planTabHref(
  detailBasePath: string,
  actionsTabHrefSegment: string,
  role: "admin" | "respondent",
  returnTo: string | null,
  options?: { openNew?: boolean },
): string {
  const base = `${detailBasePath}/${actionsTabHrefSegment}${options?.openNew ? "?new=1" : ""}`;
  return role === "admin"
    ? withAdminReturnPath(base, returnTo)
    : withRespondentReturnPath(base, returnTo);
}

export function RecommendationNextStepSection({
  actionCount,
  highlightActionText,
}: Props) {
  const { detailBasePath, role, listPath, actionsTabHrefSegment } =
    useRecommendationDetailContext();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? listPath;
  const hasActions = actionCount > 0;

  const situation = hasActions
    ? highlightActionText?.trim()
      ? `Atualizar ação “${highlightActionText.trim()}”`
      : "Há ações cadastradas. Atualize o andamento no plano de ação."
    : "Aguardando cadastro de ações / Sem ações vinculadas";

  return (
    <section aria-labelledby="rec-next-step-heading" className={overviewStack}>
      <OverviewBlockTitle
        id="rec-next-step-heading"
        title="Próximo passo"
        description="Ação recomendada para avançar nesta recomendação."
      />

      <OverviewSoftPanel className="space-y-4">
        <RecommendationCardField label={RECOMMENDATION_CARD_LABELS.situation}>
          <RecommendationCardText variant="meta">{situation}</RecommendationCardText>
        </RecommendationCardField>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <RecommendationCardText variant="metaSecondary" className="min-w-0 flex-1">
            {hasActions
              ? "Use o plano de ação para atualizar o andamento."
              : "Cadastre a primeira ação para iniciar a execução."}
          </RecommendationCardText>

          <Link
            href={planTabHref(
              detailBasePath,
              actionsTabHrefSegment,
              role,
              returnTo,
              { openNew: !hasActions },
            )}
            className={`${formSurface.primaryButton} w-full justify-center sm:w-auto sm:min-w-44`}
          >
            {hasActions ? "Ir para plano de ação" : "Cadastrar ação"}
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
          </Link>
        </div>
      </OverviewSoftPanel>
    </section>
  );
}
