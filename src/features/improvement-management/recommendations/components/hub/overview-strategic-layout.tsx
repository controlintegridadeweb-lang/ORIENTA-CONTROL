"use client";

import type { ActionPlanListItem } from "@/features/improvement-management/action-plans/types";
import {
  RecommendationContextSection,
  RecommendationScopeHeader,
} from "./recommendation-context-section";
import { OriginCriterionSection } from "./origin-criterion-section";
import { OfficialRecommendationSection } from "./official-recommendation-section";
import { RecommendationNextStepSection } from "./recommendation-next-step-section";
import { ActionPlanOverviewSummary } from "./action-plan-overview-summary";
import { OverviewBlockTitle } from "./overview-section-primitives";
import { WORKSPACE_TABS } from "./workspace-tab-meta";
import { pickDisplayPlan } from "@/features/improvement-management/action-plans/plan-selectors";

type Props = {
  row: ActionPlanListItem;
};

const OVERVIEW_META = WORKSPACE_TABS.find((tab) => tab.key === "overview")!;

/** Composição da aba Visão geral — compreender contexto e situação (sem edição). */
export function OverviewStrategicLayout({ row }: Props) {
  const activeActionCount = row.plans.filter((plan) => plan.status !== "cancelled").length;
  const highlight = pickDisplayPlan(row);

  return (
    <div className="space-y-8">
      <section aria-labelledby="rec-overview-heading" className="space-y-4">
        <OverviewBlockTitle
          id="rec-overview-heading"
          title={OVERVIEW_META.label}
          description={OVERVIEW_META.description}
        />
        <RecommendationScopeHeader row={row} />
      </section>

      <RecommendationContextSection row={row} />
      <OriginCriterionSection
        questionPrompt={row.questionPrompt}
        recommendationType={row.recommendationType}
        axisName={row.axisName}
      />
      <OfficialRecommendationSection
        recommendationText={row.recommendationText}
        axisName={row.axisName}
      />
      <ActionPlanOverviewSummary plans={row.plans} axisName={row.axisName} />
      <RecommendationNextStepSection
        actionCount={activeActionCount}
        axisName={row.axisName}
        highlightActionText={highlight?.actionText ?? null}
      />
    </div>
  );
}
