"use client";

import { useMemo } from "react";
import { toRecommendationCardViewModel } from "@/features/improvement-management/recommendations/components/respondent/recommendation-card-view-model";
import { RespondentRecommendationCard } from "@/features/improvement-management/recommendations/components/respondent/respondent-recommendation-card";
import { RecommendationHierarchy } from "@/features/improvement-management/recommendations/components/recommendation-hierarchy";
import { groupRecommendationsByAxisAndSection } from "@/features/improvement-management/recommendations/group-recommendations-by-axis-section";
import type { RespondentRecommendationItem } from "@/features/improvement-management/recommendations/respondent-presentation";

type Props = {
  items: RespondentRecommendationItem[];
  /** Lista de origem, com filtros persistidos para retorno explícito. */
  returnPath: string;
};

export function RespondentRecommendationList({ items, returnPath }: Props) {
  const groups = useMemo(
    () => groupRecommendationsByAxisAndSection(items),
    [items],
  );

  if (items.length === 0) return null;

  return (
    <RecommendationHierarchy
      groups={groups}
      listLabel="Recomendações por eixo e seção"
      renderRecommendation={(item) => {
        const viewModel = toRecommendationCardViewModel(item, returnPath, {
          recommendationDisplayCode: item.recommendationDisplayCode,
        });
        return <RespondentRecommendationCard viewModel={viewModel} />;
      }}
    />
  );
}
