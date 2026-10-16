"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { actionNumberInSection } from "@/features/improvement-management/action-plans/section-action-plan-copy";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import type {
  SectionActionPlanAxisGroup,
  SectionActionPlanGroup,
} from "@/features/improvement-management/action-plans/section-action-plan-model";
import { PlanStatusBadge } from "@/features/improvement-management/action-plans/components/shared/plan-status-badge";
import {
  RecommendationCardField,
  RecommendationCardText,
} from "@/features/improvement-management/recommendations/components/recommendation-card-field";
import {
  recommendationAxisSurface,
  recommendationCardShell,
  recommendationHierarchySurface,
} from "@/features/improvement-management/recommendations/components/recommendation-list-surface";
import { countLabel } from "@/shared/format/count-label";
import { usePagination } from "@/shared/hooks/use-pagination";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import { Pagination } from "@/shared/ui/components/pagination";

type Props = {
  hierarchy: SectionActionPlanAxisGroup[];
  planHref: (section: SectionActionPlanGroup) => string;
  actionHref?: (section: SectionActionPlanGroup, recommendationId: string, actionId: string) => string;
  actionLinkLabel?: string;
  progressHref?: (section: SectionActionPlanGroup, recommendationId: string, actionId: string) => string;
  showOrganization?: boolean;
};

type ActionRow = {
  axisKey: string;
  axisId: string;
  axisName: string;
  organizationName: string;
  formName: string;
  periodLabel: string;
  sectionKey: string;
  section: SectionActionPlanGroup;
  recommendationId: string;
  action: ActionPlanAction;
  actionLabel: string;
};

function flattenActions(hierarchy: readonly SectionActionPlanAxisGroup[]): ActionRow[] {
  const rows: ActionRow[] = [];
  for (const axis of hierarchy) {
    for (const section of axis.sections) {
      section.recommendations.forEach((recommendation, recommendationIndex) => {
        recommendation.actions.forEach((action, actionIndex) => {
          const number = actionNumberInSection(section, recommendationIndex, actionIndex);
          rows.push({
            axisKey: axis.key,
            axisId: axis.axisId,
            axisName: axis.axisName,
            organizationName: axis.organizationName,
            formName: axis.formName,
            periodLabel: axis.periodLabel,
            sectionKey: section.key,
            section,
            recommendationId: recommendation.recommendationId,
            action,
            actionLabel: `Ação A${number}`,
          });
        });
      });
    }
  }
  return rows;
}

type PageSection = {
  sectionKey: string;
  section: SectionActionPlanGroup;
  rows: ActionRow[];
};

type PageAxis = {
  axisKey: string;
  axisId: string;
  axisName: string;
  organizationName: string;
  formName: string;
  periodLabel: string;
  sections: PageSection[];
};

function groupPageRows(rows: readonly ActionRow[]): PageAxis[] {
  const axes: PageAxis[] = [];
  for (const row of rows) {
    let axis = axes[axes.length - 1];
    if (!axis || axis.axisKey !== row.axisKey) {
      axis = {
        axisKey: row.axisKey,
        axisId: row.axisId,
        axisName: row.axisName,
        organizationName: row.organizationName,
        formName: row.formName,
        periodLabel: row.periodLabel,
        sections: [],
      };
      axes.push(axis);
    }
    let section = axis.sections[axis.sections.length - 1];
    if (!section || section.sectionKey !== row.sectionKey) {
      section = { sectionKey: row.sectionKey, section: row.section, rows: [] };
      axis.sections.push(section);
    }
    section.rows.push(row);
  }
  return axes;
}

export function SectionActionPlanAllActions({
  hierarchy,
  planHref,
  actionHref,
  actionLinkLabel = "Abrir ação",
  progressHref,
  showOrganization = false,
}: Props) {
  const rows = useMemo(() => flattenActions(hierarchy), [hierarchy]);
  const pagination = usePagination({
    totalItems: rows.length,
    resetKey: rows.map((row) => row.action.id).join("|"),
  });
  const pageAxes = groupPageRows(pagination.pageItems(rows));

  if (rows.length === 0) {
    return (
      <p className={typography.sectionDescription}>
        Nenhuma ação cadastrada nos eixos e seções deste plano.
      </p>
    );
  }

  return (
    <div className="space-y-6" aria-label="Todas as ações do plano">
      <p className={typography.sectionDescription}>
        {countLabel(rows.length, "ação", "ações")} de todos os eixos e seções.
      </p>
      <div className={recommendationHierarchySurface.stack}>
      {pageAxes.map((axis) => {
        const surface = recommendationAxisSurface(axis.axisName);
        const axisDomId = `all-actions-axis-${axis.axisId || axis.axisName}`;
        const context = [
          showOrganization ? axis.organizationName : null,
          axis.formName,
          axis.periodLabel,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <section
            key={axis.axisKey}
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

            {axis.sections.map((group) => {
              const sectionLabel = `Seção ${group.section.sectionDisplayNumber}`;

              return (
                <div key={group.sectionKey} className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className={recommendationHierarchySurface.sectionTitle}>
                      {sectionLabel}. {group.section.sectionName}
                    </h3>
                    <Link
                      href={planHref(group.section)}
                      className={`${formSurface.secondaryButtonSm} w-full justify-center sm:w-auto`}
                    >
                      Abrir plano da seção
                      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                    </Link>
                  </div>

                  <ul className="flex flex-col gap-3" role="list">
                    {group.rows.map((row) => {
                      const sector = row.action.responsibleSector.trim() || "Não informado";

                      return (
                        <li key={row.action.id} role="listitem">
                          <article
                            className={recommendationCardShell.article}
                            aria-label={row.actionLabel}
                          >
                            <span
                              aria-hidden
                              className={recommendationCardShell.accentRail}
                              style={{ backgroundColor: surface.accent }}
                            />
                            <div className={`${recommendationCardShell.body} pl-5 sm:pl-6`}>
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <RecommendationCardField label={row.actionLabel}>
                                  <RecommendationCardText variant="highlight">
                                    {row.action.actionText}
                                  </RecommendationCardText>
                                </RecommendationCardField>
                                <PlanStatusBadge status={row.action.status} />
                              </div>
                              <dl className="grid gap-3 sm:grid-cols-2">
                                <RecommendationCardField label="Área responsável">
                                  <RecommendationCardText>{sector}</RecommendationCardText>
                                </RecommendationCardField>
                                <RecommendationCardField label="Progresso">
                                  <RecommendationCardText>
                                    {row.action.progressPercentage}%
                                  </RecommendationCardText>
                                </RecommendationCardField>
                              </dl>
                              {actionHref || progressHref ? (
                                <div className="flex flex-wrap justify-end gap-2">
                                  {progressHref && row.action.status !== "cancelled" ? (
                                    <Link
                                      href={progressHref(row.section, row.recommendationId, row.action.id)}
                                      className={`${formSurface.secondaryButtonSm} w-full justify-center sm:w-auto`}
                                    >
                                      Andamento
                                    </Link>
                                  ) : null}
                                  {actionHref ? (
                                    <Link
                                      href={actionHref(row.section, row.recommendationId, row.action.id)}
                                      className={`${formSurface.secondaryButtonSm} w-full justify-center sm:w-auto`}
                                    >
                                      {actionLinkLabel}
                                      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                                    </Link>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </article>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </section>
        );
      })}
      </div>
      <Pagination
        pagination={pagination}
        variant="panel"
        resultLabel={{ singular: "ação", plural: "ações" }}
        aria-label="Paginação de ações"
      />
    </div>
  );
}
