import {
  sectionOriginQuestions,
  type SectionActionPlanGroup,
} from "@/features/improvement-management/action-plans/section-action-plan-model";
import { sectionExecutionSituationSummary } from "@/features/improvement-management/action-plans/section-action-plan-copy";
import { OriginQuestionList } from "@/features/improvement-management/recommendations/components/origin-question-list";
import {
  originQuestionsHeading,
  RECOMMENDATION_CARD_LABELS,
} from "@/features/improvement-management/recommendations/components/respondent/recommendation-card-view-model";
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
import { getAxisTheme } from "@/shared/theme/axis-theme";
import { countLabel } from "@/shared/format/count-label";

type Props = {
  section: SectionActionPlanGroup;
};

export function SectionWorkspaceOverview({ section }: Props) {
  const axisTheme = getAxisTheme(section.axisName);
  const originQuestions = sectionOriginQuestions(section);
  const cycleLabel = [section.formName, section.periodLabel].filter(Boolean).join(" · ");

  return (
    <div className="space-y-8">
      <section aria-labelledby="section-overview-heading" className={overviewStack}>
        <OverviewBlockTitle
          id="section-overview-heading"
          title="Visão geral"
          description="Contexto da seção, critérios de origem e recomendações do diagnóstico."
        />
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

      <section aria-labelledby="section-origin-heading" className={overviewStack}>
        <OverviewBlockTitle
          id="section-origin-heading"
          title={originQuestionsHeading(originQuestions.length)}
          description="Todos os critérios do diagnóstico que originam o plano desta seção."
        />
        <OriginQuestionList
          accent={axisTheme.primary}
          soft={axisTheme.softBackground}
          questions={originQuestions}
        />
      </section>

      <section aria-labelledby="section-recommendations-heading" className={overviewStack}>
        <OverviewBlockTitle
          id="section-recommendations-heading"
          title="Recomendações da seção"
          description="Cada recomendação permanece vinculada à pergunta de origem e às ações cadastradas."
        />
        <div className="space-y-4">
          {section.recommendations.map((recommendation, index) => (
            <OverviewSoftPanel key={recommendation.recommendationId} className="space-y-4">
              <RecommendationCardField
                label={`Recomendação ${section.sectionDisplayNumber}.${index + 1}`}
              >
                <div
                  className="rounded-lg px-3.5 py-3 sm:px-4 sm:py-3.5"
                  style={{ backgroundColor: axisTheme.primary }}
                >
                  <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-white">
                    {recommendation.recommendationText}
                  </p>
                </div>
              </RecommendationCardField>
              <RecommendationCardField label={originQuestionsHeading(1)}>
                <RecommendationCardText preWrap>
                  {recommendation.questionPrompt || "—"}
                </RecommendationCardText>
              </RecommendationCardField>
              <RecommendationCardText variant="meta">
                {countLabel(recommendation.actions.length, "ação vinculada", "ações vinculadas")}
              </RecommendationCardText>
            </OverviewSoftPanel>
          ))}
        </div>
      </section>
    </div>
  );
}
