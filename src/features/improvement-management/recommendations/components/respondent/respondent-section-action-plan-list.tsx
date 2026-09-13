"use client";

import { useMemo } from "react";
import type { RespondentRecommendationItem } from "@/features/improvement-management/recommendations/respondent-presentation";
import {
  buildSectionActionPlanHierarchy,
  filterSectionHierarchyByMatchingRecommendations,
  sectionActionPlanSourcesFromListItems,
} from "@/features/improvement-management/action-plans/section-action-plan-model";
import { SectionActionPlanHierarchyList } from "@/features/improvement-management/action-plans/components/section/section-action-plan-hierarchy-list";
import { respondentSectionPlanEntryPath } from "@/shared/navigation/respondent-portfolio-paths";

type Props = {
  items: RespondentRecommendationItem[];
  matchingItems?: RespondentRecommendationItem[];
  returnPath: string;
};

export function RespondentSectionActionPlanList({
  items,
  matchingItems,
  returnPath,
}: Props) {
  const hierarchy = useMemo(() => {
    const full = buildSectionActionPlanHierarchy(sectionActionPlanSourcesFromListItems(items));
    if (!matchingItems) return full;
    return filterSectionHierarchyByMatchingRecommendations(
      full,
      new Set(matchingItems.map((item) => item.recommendationId)),
    );
  }, [items, matchingItems]);

  return (
    <SectionActionPlanHierarchyList
      hierarchy={hierarchy}
      planHref={(section) =>
        respondentSectionPlanEntryPath(section.sectionId, section.cycleId, returnPath)
      }
    />
  );
}
