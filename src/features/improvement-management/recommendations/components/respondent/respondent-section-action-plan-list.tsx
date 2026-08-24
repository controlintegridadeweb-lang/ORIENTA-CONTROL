"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { RespondentRecommendationItem } from "@/features/improvement-management/recommendations/respondent-presentation";
import {
  buildSectionActionPlanHierarchy,
  sectionActionPlanSourcesFromListItems,
  type SectionActionPlanMetrics,
} from "@/features/improvement-management/action-plans/section-action-plan-model";
import {
  SectionPlanStatusBadge,
  sectionPlanStatusFromMetrics,
} from "@/features/improvement-management/action-plans/components/section/section-plan-status-badge";
import { respondentSectionActionWorkspacePath } from "@/shared/navigation/respondent-portfolio-paths";
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
import { RECOMMENDATION_CARD_LABELS } from "@/features/improvement-management/recommendations/components/respondent/recommendation-card-view-model";
import { RespondentRecommendationProgress } from "@/features/improvement-management/recommendations/components/respondent/respondent-recommendation-progress";

type Props = {
  items: RespondentRecommendationItem[];
  returnPath: string;
};

function countLabel(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function sectionExecutionSummary(metrics: SectionActionPlanMetrics): string {
  const parts = [
    countLabel(metrics.totalActions, "ação", "ações"),
    countLabel(metrics.completedActions, "concluída", "concluídas"),
  ];
  if (metrics.overdueActions > 0) {
    parts.push(countLabel(metrics.overdueActions, "em atraso", "em atraso"));
  }
  return parts.join(" · ");
}

export function RespondentSectionActionPlanList({ items, returnPath }: Props) {
  const hierarchy = buildSectionActionPlanHierarchy(sectionActionPlanSourcesFromListItems(items));
  if (hierarchy.length === 0) return null;

  return (
    <div
      className={recommendationHierarchySurface.stack}
      aria-label="Planos de ação por eixo e seção"
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
              style={{ borderLeftColor: surface.accent }}
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
                const href = respondentSectionActionWorkspacePath(
                  section.sectionId,
                  section.cycleId,
                  "visao-geral",
                  { returnTo: returnPath },
                );
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
                          <RecommendationCardField label="Seção">
                            <RecommendationCardText>{sectionLabel}</RecommendationCardText>
                            <RecommendationCardText variant="highlight" className="mt-1">
                              {section.sectionName}
                            </RecommendationCardText>
                          </RecommendationCardField>
                          <SectionPlanStatusBadge status={status} />
                        </div>

                        <RecommendationCardField label={RECOMMENDATION_CARD_LABELS.originQuestion}>
                          {section.recommendations.length === 0 ? (
                            <RecommendationCardText>—</RecommendationCardText>
                          ) : (
                            <div className="space-y-2">
                              {section.recommendations.map((recommendation) => (
                                <RecommendationCardText
                                  key={recommendation.recommendationId}
                                  preWrap
                                >
                                  {recommendation.questionPrompt.trim() || "—"}
                                </RecommendationCardText>
                              ))}
                            </div>
                          )}
                        </RecommendationCardField>

                        <section
                          aria-label="Acompanhamento"
                          className={recommendationCardShell.trackingDivider}
                        >
                          <RecommendationCardField label={RECOMMENDATION_CARD_LABELS.situation}>
                            <RecommendationCardText variant="meta">
                              {sectionExecutionSummary(section.metrics)}
                            </RecommendationCardText>
                            <RecommendationCardText variant="metaSecondary" className="mt-1">
                              {countLabel(
                                section.recommendations.length,
                                "recomendação de origem",
                                "recomendações de origem",
                              )}
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
