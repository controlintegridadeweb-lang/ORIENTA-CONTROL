import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { RecommendationDetailRoot } from "@/features/improvement-management/recommendations/components/hub/recommendation-detail-root";
import { Spinner } from "@/shared/ui/components/loading";
import { RESPONDENT_ACTION_PLAN_LIST_PATH } from "@/shared/navigation/respondent-portfolio-paths";
import { parseUuidParam } from "@/shared/validation/uuid";

type Props = {
  children: ReactNode;
  params: Promise<{ recommendationId: string }>;
};

/** Workspace de uma recomendação: Visão geral / Ações / Monitoramento. */
export default async function RespondentePlanoAcaoDetailLayout({ children, params }: Props) {
  const { recommendationId: rawId } = await params;
  const recommendationId = parseUuidParam(rawId);
  if (!recommendationId) {
    redirect(RESPONDENT_ACTION_PLAN_LIST_PATH);
  }

  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Spinner size="xl" className="text-brand" />
        </div>
      }
    >
      <RecommendationDetailRoot
        recommendationId={recommendationId}
        role="respondent"
        listPath={RESPONDENT_ACTION_PLAN_LIST_PATH}
        detailBasePath={`/respondente/plano-acao/${recommendationId}`}
        actionsTabHrefSegment="acoes"
        actionsTabLabel="Ações"
        workspaceSurface="operational"
      >
        {children}
      </RecommendationDetailRoot>
    </Suspense>
  );
}
