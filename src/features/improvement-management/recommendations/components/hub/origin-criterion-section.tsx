"use client";

import { presentOriginCriterion } from "./origin-criterion-view-model";
import {
  OverviewBlockTitle,
  OverviewGuidancePanel,
  OverviewSoftPanel,
  RecommendationCardField,
  RecommendationCardText,
  overviewStack,
} from "./overview-section-primitives";
import { RECOMMENDATION_CARD_LABELS } from "@/features/improvement-management/recommendations/components/respondent/recommendation-card-view-model";

type Props = {
  questionPrompt: string;
  recommendationType: string;
  /** Mantido por compatibilidade com o layout estratégico. */
  axisName?: string;
};

export function OriginCriterionSection({
  questionPrompt,
  recommendationType,
}: Props) {
  const criterion = presentOriginCriterion({ questionPrompt, recommendationType });
  if (!criterion.questionPrompt) return null;

  return (
    <section aria-labelledby="rec-origin-heading" className={overviewStack}>
      <OverviewBlockTitle
        id="rec-origin-heading"
        title="Critério de origem"
        description="Pergunta e condição do diagnóstico que originaram esta recomendação."
      />

      <OverviewSoftPanel className="space-y-4">
        <RecommendationCardField label={RECOMMENDATION_CARD_LABELS.originQuestion}>
          <OverviewGuidancePanel tone="brand">
            <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-white">
              {criterion.questionPrompt}
            </p>
          </OverviewGuidancePanel>
        </RecommendationCardField>

        {criterion.validationSituation ? (
          <RecommendationCardField label="Situação na validação">
            <RecommendationCardText variant="body">
              {criterion.validationSituation}
            </RecommendationCardText>
          </RecommendationCardField>
        ) : (
          <RecommendationCardField label="Resposta que originou a recomendação">
            <RecommendationCardText variant="body">
              {criterion.originatingAnswer}
            </RecommendationCardText>
          </RecommendationCardField>
        )}
      </OverviewSoftPanel>
    </section>
  );
}
