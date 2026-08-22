import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { RecommendationDetailRoot } from "@/features/improvement-management/recommendations/components/hub/recommendation-detail-root";
import { Spinner } from "@/shared/ui/components/loading";
import { parseUuidParam } from "@/shared/validation/uuid";

type Props = {
  children: ReactNode;
  params: Promise<{ recommendationId: string }>;
};

/** Workspace operacional: Visão geral / Plano de ação / Monitoramento. */
export default async function RespondentePlanoAcaoDetailLayout({ children, params }: Props) {
  const { recommendationId: rawId } = await params;
  const recommendationId = parseUuidParam(rawId);
  if (!recommendationId) {
    redirect("/respondente/portfolio-recomendacoes");
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
        listPath="/respondente/portfolio-recomendacoes"
        detailBasePath={`/respondente/plano-acao/${recommendationId}`}
        actionsTabHrefSegment="acoes"
        actionsTabLabel="Plano de ação"
        workspaceSurface="operational"
      >
        {children}
      </RecommendationDetailRoot>
    </Suspense>
  );
}
