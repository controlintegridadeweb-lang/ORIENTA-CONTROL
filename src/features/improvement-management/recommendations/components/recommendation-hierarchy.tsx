"use client";

import type { ReactNode } from "react";
import type {
  RecommendationAxisGroup,
  RecommendationHierarchySource,
} from "@/features/improvement-management/recommendations/group-recommendations-by-axis-section";
import {
  recommendationAxisSurface,
  recommendationHierarchySurface,
} from "@/features/improvement-management/recommendations/components/recommendation-list-surface";

type Props<T extends RecommendationHierarchySource> = {
  groups: RecommendationAxisGroup<T>[];
  renderRecommendation: (
    item: T & { recommendationDisplayCode: string },
  ) => ReactNode;
  listLabel?: string;
};

/**
 * Hierarquia Eixo → Seção → Recomendações, com acento cromático do eixo
 * (paleta FAMI institucional).
 */
export function RecommendationHierarchy<T extends RecommendationHierarchySource>({
  groups,
  renderRecommendation,
  listLabel = "Recomendações por eixo e seção",
}: Props<T>) {
  if (groups.length === 0) return null;

  return (
    <div
      className={recommendationHierarchySurface.stack}
      role="list"
      aria-label={listLabel}
    >
      {groups.map((axis) => {
        const surface = recommendationAxisSurface(axis.axisName);
        const axisDomId = `axis-${axis.axisId || axis.axisName}`;

        return (
          <section
            key={axis.axisId || axis.axisName}
            role="listitem"
            aria-labelledby={axisDomId}
            className={recommendationHierarchySurface.axisBlock}
          >
            <header
              className={recommendationHierarchySurface.axisHeader}
              style={{
                borderLeftColor: surface.accent,
                backgroundColor: surface.soft,
              }}
            >
              <div>
                <p
                  className={recommendationHierarchySurface.axisEyebrow}
                  style={{ color: surface.accent }}
                >
                  Eixo
                </p>
                <h2 id={axisDomId} className={recommendationHierarchySurface.axisTitle}>
                  {axis.axisName || "Eixo sem nome"}
                </h2>
              </div>
            </header>

            <div className="space-y-8 sm:space-y-10">
              {axis.sections.map((section) => {
                const sectionDomId = `section-${section.sectionId || section.sectionName}`;
                return (
                  <section
                    key={section.sectionId || `${axis.axisId}-${section.sectionName}`}
                    aria-labelledby={sectionDomId}
                    className={recommendationHierarchySurface.sectionBlock}
                  >
                    <header className={recommendationHierarchySurface.sectionHeader}>
                      <span
                        aria-hidden
                        className={recommendationHierarchySurface.sectionAccent}
                        style={{ backgroundColor: surface.accent }}
                      />
                      <h3
                        id={sectionDomId}
                        className={recommendationHierarchySurface.sectionTitle}
                      >
                        Seção {section.sectionDisplayNumber}
                        {section.sectionName ? ` — ${section.sectionName}` : ""}
                      </h3>
                    </header>

                    <ul className={recommendationHierarchySurface.cards} role="list">
                      {section.recommendations.map((recommendation) => (
                        <li key={recommendation.recommendationId} role="listitem">
                          {renderRecommendation(recommendation)}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
