"use client";

import { useMemo } from "react";
import type { RespondentRecommendationItem } from "@/features/improvement-management/recommendations/respondent-presentation";
import {
  buildSectionActionPlanHierarchy,
  filterSectionHierarchyByMatchingRecommendations,
  sectionActionPlanSourcesFromListItems,
  type SectionActionPlanGroup,
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

  function sectionActionHref(
    section: SectionActionPlanGroup,
    actionId: string,
    panel?: "progress",
  ) {
    const href = respondentSectionPlanEntryPath(section.sectionId, section.cycleId, returnPath);
    const queryIndex = href.indexOf("?");
    const path = queryIndex >= 0 ? href.slice(0, queryIndex) : href;
    const params = new URLSearchParams(queryIndex >= 0 ? href.slice(queryIndex + 1) : "");
    params.set("action", actionId);
    if (panel) params.set("panel", panel);
    return `${path}?${params.toString()}`;
  }

  return (
    <SectionActionPlanHierarchyList
      hierarchy={hierarchy}
      planHref={(section) =>
        respondentSectionPlanEntryPath(section.sectionId, section.cycleId, returnPath)
      }
      actionLinkLabel="Gerenciar ação"
      actionHref={(section, _recommendationId, actionId) => sectionActionHref(section, actionId)}
      progressHref={(section, _recommendationId, actionId) =>
        sectionActionHref(section, actionId, "progress")
      }
    />
  );
}
