import type { SectionActionPlanGroup } from "@/features/improvement-management/action-plans/section-action-plan-model";
import { sectionExecutionSituationSummary } from "@/features/improvement-management/action-plans/section-action-plan-copy";
import { RECOMMENDATION_CARD_LABELS } from "@/features/improvement-management/recommendations/components/respondent/recommendation-card-view-model";
import { RespondentRecommendationProgress } from "@/features/improvement-management/recommendations/components/respondent/respondent-recommendation-progress";
import {
  OverviewBlockTitle,
  OverviewMetaGrid,
  OverviewMetaItem,
  OverviewSoftPanel,
  RecommendationCardField,
  RecommendationCardText,
  overviewStack,
} from "@/features/improvement-management/recommendations/components/hub/overview-section-primitives";
import { SectionMonitoringSectors } from "@/features/improvement-management/action-plans/components/section/section-monitoring-sectors";

type Props = {
  section: SectionActionPlanGroup;
};

export function SectionWorkspaceOverview({ section }: Props) {
  const cycleLabel = [section.formName, section.periodLabel].filter(Boolean).join(" · ");

  return (
    <div className="space-y-8">
      <section aria-labelledby="section-overview-heading" className={overviewStack}>
        <OverviewBlockTitle id="section-overview-heading" title="Visão geral" />
        <OverviewSoftPanel>
          <OverviewMetaGrid>
            <OverviewMetaItem label="Formulário" value={cycleLabel || "—"} />
            <OverviewMetaItem label="Órgão" value={section.organizationName || "—"} />
            <OverviewMetaItem label="Eixo" value={section.axisName || "—"} />
            <OverviewMetaItem
              label={`Seção ${section.sectionDisplayNumber}`}
              value={section.sectionName}
            />
            <OverviewMetaItem
              label={RECOMMENDATION_CARD_LABELS.situation}
              value={sectionExecutionSituationSummary(section)}
            />
            <RecommendationCardField label={RECOMMENDATION_CARD_LABELS.progress}>
              <div className="flex items-center gap-2.5">
                <RecommendationCardText variant="meta" as="span" className="shrink-0 tabular-nums">
                  {section.metrics.progressPercentage}%
                </RecommendationCardText>
                <div className="min-w-16 flex-1">
                  <RespondentRecommendationProgress
                    value={section.metrics.progressPercentage}
                    size="sm"
                  />
                </div>
              </div>
            </RecommendationCardField>
          </OverviewMetaGrid>
        </OverviewSoftPanel>
      </section>

      <SectionMonitoringSectors section={section} />
    </div>
  );
}
