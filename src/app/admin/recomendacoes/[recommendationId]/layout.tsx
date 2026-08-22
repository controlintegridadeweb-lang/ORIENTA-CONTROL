import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { RecommendationDetailRoot } from "@/features/improvement-management/recommendations/components/hub/recommendation-detail-root";
import { Spinner } from "@/shared/ui/components/loading";
import { parseUuidParam } from "@/shared/validation/uuid";

type Props = {
  children: ReactNode;
  params: Promise<{ recommendationId: string }>;
};

/** Superfície documental da recomendação (admin). */
export default async function AdminRecomendacaoDetailLayout({ children, params }: Props) {
  const { recommendationId: rawId } = await params;
  const recommendationId = parseUuidParam(rawId);
  if (!recommendationId) {
    redirect("/admin/recomendacoes");
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
        listPath="/admin/recomendacoes"
        detailBasePath={`/admin/recomendacoes/${recommendationId}`}
        workspaceSurface="document"
      >
        {children}
      </RecommendationDetailRoot>
    </Suspense>
  );
}
