"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { RespondentRecommendationItem } from "@/features/improvement-management/recommendations/respondent-presentation";
import {
  buildSectionActionPlanHierarchy,
  sectionActionPlanSourcesFromListItems,
  type SectionActionPlanRecommendation,
} from "@/features/improvement-management/action-plans/section-action-plan-model";
import {
  SectionPlanStatusBadge,
  sectionPlanStatusFromMetrics,
} from "@/features/improvement-management/action-plans/components/section/section-plan-status-badge";
import { respondentActionWorkspacePath } from "@/shared/navigation/respondent-portfolio-paths";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import {
  RecommendationCardField,
  RecommendationCardText,
} from "@/features/improvement-management/recommendations/components/recommendation-card-field";
import {
  recommendationAxisSurface,
  recommendationCardShell,
  recommendationHierarchySurface,
} from "@/features/improvement-management/recommendations/components/recommendation-list-surface";
import { OverviewSoftPanel } from "@/features/improvement-management/recommendations/components/hub/overview-section-primitives";
import { RECOMMENDATION_CARD_LABELS } from "@/features/improvement-management/recommendations/components/respondent/recommendation-card-view-model";
import { RespondentRecommendationProgress } from "@/features/improvement-management/recommendations/components/respondent/respondent-recommendation-progress";

type Props = {
  items: RespondentRecommendationItem[];
  returnPath: string;
};

function countLabel(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function isRecommendationCompleted(
  recommendation: SectionActionPlanRecommendation,
): boolean {
  const active = recommendation.actions.filter((action) => action.status !== "cancelled");
  if (active.length === 0) return false;
  return active.every(
    (action) => action.progressPercentage >= 100 || action.status === "completed",
  );
}

function sectionSituationSummary(
  recommendations: readonly SectionActionPlanRecommendation[],
): string {
  const completed = recommendations.filter(isRecommendationCompleted).length;
  return [
    countLabel(recommendations.length, "recomendação", "recomendações"),
    countLabel(completed, "concluída", "concluídas"),
  ].join(" · ");
}

function OriginQuestionList({
  questions,
  accent,
  soft,
}: {
  questions: Array<{ id: string; prompt: string }>;
  accent: string;
  soft: string;
}) {
  if (questions.length === 0) {
    return <RecommendationCardText>—</RecommendationCardText>;
  }

  return (
    <OverviewSoftPanel padded={false} className="overflow-hidden">
      <ol className="divide-y divide-slate-200/70" role="list">
        {questions.map((question, index) => (
          <li
            key={question.id}
            className="flex gap-3 px-4 py-3.5 sm:gap-3.5 sm:px-5 sm:py-4"
            role="listitem"
          >
            <span
              aria-hidden
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
              style={{ backgroundColor: soft, color: accent }}
            >
              {index + 1}
            </span>
            <RecommendationCardText preWrap className="min-w-0 flex-1">
              {question.prompt || "—"}
            </RecommendationCardText>
          </li>
        ))}
      </ol>
    </OverviewSoftPanel>
  );
}

export function RespondentSectionActionPlanList({ items, returnPath }: Props) {
  const hierarchy = buildSectionActionPlanHierarchy(sectionActionPlanSourcesFromListItems(items));
  if (hierarchy.length === 0) return null;

  return (
    <div
      className={recommendationHierarchySurface.stack}
      aria-label="Planos de integridade e compliance por eixo e seção"
    >
      {hierarchy.map((axis) => {
        const surface = recommendationAxisSurface(axis.axisName);
        const axisDomId = `axis-${axis.axisId || axis.axisName}`;

        return (
          <section
            key={axis.key}
            className={recommendationHierarchySurface.axisBlock}
            aria-labelledby={axisDomId}
          >
            <header
              className={recommendationHierarchySurface.axisHeader}
              style={{
                borderLeftColor: surface.accent,
                backgroundColor: surface.soft,
              }}
            >
              <p
                className={recommendationHierarchySurface.axisEyebrow}
                style={{ color: surface.accent }}
              >
                Eixo
              </p>
              <h2 id={axisDomId} className={recommendationHierarchySurface.axisTitle}>
                {axis.axisName || "Eixo sem nome"}
              </h2>
              <p className={typography.sectionDescription}>
                {axis.formName} · {axis.periodLabel}
              </p>
            </header>

            <ul className={recommendationHierarchySurface.cards} role="list">
              {axis.sections.map((section) => {
                const entryRecommendationId = section.recommendations[0]?.recommendationId;
                const href = entryRecommendationId
                  ? respondentActionWorkspacePath(entryRecommendationId, "visao-geral", {
                      returnTo: returnPath,
                    })
                  : returnPath;
                const status = sectionPlanStatusFromMetrics(section.metrics);
                const sectionLabel = `Seção ${section.sectionDisplayNumber}`;

                return (
                  <li key={section.key} role="listitem">
                    <article
                      className={recommendationCardShell.article}
                      aria-label={`${sectionLabel} — ${section.sectionName}`}
                    >
                      <span
                        aria-hidden
                        className={recommendationCardShell.accentRail}
                        style={{ backgroundColor: surface.accent }}
                      />
                      <div className={`${recommendationCardShell.body} pl-5 sm:pl-6`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <RecommendationCardField label={sectionLabel}>
                            <RecommendationCardText variant="highlight">
                              {section.sectionName}
                            </RecommendationCardText>
                          </RecommendationCardField>
                          <SectionPlanStatusBadge status={status} />
                        </div>

                        <RecommendationCardField label={RECOMMENDATION_CARD_LABELS.originQuestion}>
                          <OriginQuestionList
                            accent={surface.accent}
                            soft={surface.soft}
                            questions={section.recommendations.map((recommendation) => ({
                              id: recommendation.recommendationId,
                              prompt: recommendation.questionPrompt.trim(),
                            }))}
                          />
                        </RecommendationCardField>

                        <section
                          aria-label="Acompanhamento"
                          className={recommendationCardShell.trackingDivider}
                        >
                          <RecommendationCardField label={RECOMMENDATION_CARD_LABELS.situation}>
                            <RecommendationCardText variant="meta">
                              {sectionSituationSummary(section.recommendations)}
                            </RecommendationCardText>
                          </RecommendationCardField>

                          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <RecommendationCardField
                              label={RECOMMENDATION_CARD_LABELS.progress}
                              className="min-w-0 max-w-xs flex-1"
                            >
                              <div className="flex items-center gap-2.5">
                                <RecommendationCardText
                                  variant="meta"
                                  as="span"
                                  className="shrink-0 tabular-nums"
                                >
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

                            <Link
                              href={href}
                              className={`${formSurface.primaryButton} w-full justify-center sm:w-auto sm:min-w-44`}
                            >
                              Abrir plano da seção
                              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                            </Link>
                          </div>
                        </section>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
