"use client";

import { useMemo } from "react";
import type { AdminRecommendationItem } from "@/features/improvement-management/recommendations/admin-presentation";
import { groupRecommendationsByAxisAndSection } from "@/features/improvement-management/recommendations/group-recommendations-by-axis-section";
import { RecommendationHierarchy } from "@/features/improvement-management/recommendations/components/recommendation-hierarchy";
import { AdminRecommendationHierarchyItem } from "./admin-recommendation-hierarchy-item";

type Props = {
  items: AdminRecommendationItem[];
  /** Quando todas as linhas são do mesmo órgão, omite o nome repetido. */
  hideOrganization?: boolean;
};

export function AdminRecommendationList({ items, hideOrganization = false }: Props) {
  const groups = useMemo(
    () => groupRecommendationsByAxisAndSection(items),
    [items],
  );

  if (items.length === 0) return null;

  return (
    <RecommendationHierarchy
      groups={groups}
      listLabel="Recomendações por eixo e seção"
      renderRecommendation={(item) => (
        <AdminRecommendationHierarchyItem
          item={item}
          recommendationDisplayCode={item.recommendationDisplayCode}
          showOrganization={!hideOrganization}
        />
      )}
    />
  );
}
