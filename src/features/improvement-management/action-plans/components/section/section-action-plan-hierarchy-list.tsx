"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  sectionOriginQuestions,
  type SectionActionPlanAxisGroup,
  type SectionActionPlanGroup,
} from "@/features/improvement-management/action-plans/section-action-plan-model";
import { sectionRecommendationSituationSummary } from "@/features/improvement-management/action-plans/section-action-plan-copy";
import {
  SectionPlanStatusBadge,
  sectionPlanStatusFromMetrics,
} from "@/features/improvement-management/action-plans/components/section/section-plan-status-badge";
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
import { OriginQuestionList } from "@/features/improvement-management/recommendations/components/origin-question-list";
import {
  originQuestionsHeading,
  RECOMMENDATION_CARD_LABELS,
} from "@/features/improvement-management/recommendations/components/respondent/recommendation-card-view-model";
import { RespondentRecommendationProgress } from "@/features/improvement-management/recommendations/components/respondent/respondent-recommendation-progress";

type Props = {
  hierarchy: SectionActionPlanAxisGroup[];
  planHref: (section: SectionActionPlanGroup) => string;
  showOrganization?: boolean;
  listLabel?: string;
};

export function SectionActionPlanHierarchyList({
  hierarchy,
  planHref,
  showOrganization = false,
  listLabel = "Planos de integridade e compliance por eixo e seção",
}: Props) {
  if (hierarchy.length === 0) return null;

  return (
    <div className={recommendationHierarchySurface.stack} aria-label={listLabel}>
      {hierarchy.map((axis) => {
        const surface = recommendationAxisSurface(axis.axisName);
        const axisDomId = `axis-${axis.axisId || axis.axisName}`;
        const context = [
          showOrganization ? axis.organizationName : null,
          axis.formName,
          axis.periodLabel,
        ]
          .filter(Boolean)
          .join(" · ");

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
              {context ? <p className={typography.sectionDescription}>{context}</p> : null}
            </header>

            <ul className={recommendationHierarchySurface.cards} role="list">
              {axis.sections.map((section) => {
                const href = planHref(section);
                const status = sectionPlanStatusFromMetrics(section.metrics);
                const sectionLabel = `Seção ${section.sectionDisplayNumber}`;
                const originQuestions = sectionOriginQuestions(section);

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

                        <RecommendationCardField label={originQuestionsHeading(originQuestions.length)}>
                          <OriginQuestionList
                            accent={surface.accent}
                            soft={surface.soft}
                            questions={originQuestions}
                          />
                        </RecommendationCardField>

                        <section
                          aria-label="Acompanhamento"
                          className={recommendationCardShell.trackingDivider}
                        >
                          <RecommendationCardField label={RECOMMENDATION_CARD_LABELS.situation}>
                            <RecommendationCardText variant="meta">
                              {sectionRecommendationSituationSummary(section.recommendations)}
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
