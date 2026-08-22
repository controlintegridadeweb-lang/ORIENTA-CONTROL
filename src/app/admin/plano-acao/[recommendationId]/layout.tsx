import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { RecommendationDetailRoot } from "@/features/improvement-management/recommendations/components/hub/recommendation-detail-root";
import { Spinner } from "@/shared/ui/components/loading";
import { parseUuidParam } from "@/shared/validation/uuid";

type Props = {
  children: ReactNode;
  params: Promise<{ recommendationId: string }>;
};

/** Workspace de supervisão do Plano de ação (admin). */
export default async function AdminPlanoAcaoDetailLayout({ children, params }: Props) {
  const { recommendationId: rawId } = await params;
  const recommendationId = parseUuidParam(rawId);
  if (!recommendationId) {
    redirect("/admin/plano-acao");
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
        role="admin"
        listPath="/admin/plano-acao"
        detailBasePath={`/admin/plano-acao/${recommendationId}`}
        actionsTabHrefSegment="acoes"
        actionsTabLabel="Plano de ação"
        workspaceSurface="supervision"
      >
        {children}
      </RecommendationDetailRoot>
    </Suspense>
  );
}
