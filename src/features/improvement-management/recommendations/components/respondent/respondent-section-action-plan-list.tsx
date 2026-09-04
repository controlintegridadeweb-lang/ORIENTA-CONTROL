"use client";

import type { RespondentRecommendationItem } from "@/features/improvement-management/recommendations/respondent-presentation";
import {
  buildSectionActionPlanHierarchy,
  sectionActionPlanSourcesFromListItems,
} from "@/features/improvement-management/action-plans/section-action-plan-model";
import { SectionActionPlanHierarchyList } from "@/features/improvement-management/action-plans/components/section/section-action-plan-hierarchy-list";
import { respondentSectionPlanEntryPath } from "@/shared/navigation/respondent-portfolio-paths";

type Props = {
  items: RespondentRecommendationItem[];
  returnPath: string;
};

export function RespondentSectionActionPlanList({ items, returnPath }: Props) {
  const hierarchy = buildSectionActionPlanHierarchy(sectionActionPlanSourcesFromListItems(items));

  return (
    <SectionActionPlanHierarchyList
      hierarchy={hierarchy}
      planHref={(section) =>
        respondentSectionPlanEntryPath(section.sectionId, section.cycleId, returnPath)
      }
    />
  );
}
