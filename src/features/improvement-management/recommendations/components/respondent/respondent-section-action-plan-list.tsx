"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { RespondentRecommendationItem } from "@/features/improvement-management/recommendations/respondent-presentation";
import {
  buildSectionActionPlanHierarchy,
  sectionActionPlanSourcesFromListItems,
} from "@/features/improvement-management/action-plans/section-action-plan-model";
import {
  SectionPlanStatusBadge,
  sectionPlanStatusFromMetrics,
} from "@/features/improvement-management/action-plans/components/section/section-plan-status-badge";
import { respondentSectionActionWorkspacePath } from "@/shared/navigation/respondent-portfolio-paths";
import { getAxisTheme } from "@/shared/theme/axis-theme";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import { AdminActionPlanProgress } from "@/features/improvement-management/action-plans/components/admin/admin-action-plan-progress";


type Props = {
  items: RespondentRecommendationItem[];
  returnPath: string;
};

function countLabel(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function RespondentSectionActionPlanList({ items, returnPath }: Props) {
  const hierarchy = buildSectionActionPlanHierarchy(sectionActionPlanSourcesFromListItems(items));
  if (hierarchy.length === 0) return null;

  return (
    <div className="space-y-10" aria-label="Planos de ação por eixo e seção">
      {hierarchy.map((axis) => {
        const theme = getAxisTheme(axis.axisName);
        return (
          <section key={axis.key} className="space-y-5">
            <header
              className="border-l-4 py-1 pl-4"
              style={{ borderColor: theme.primary }}
            >
              <p className={typography.contextLabel}>{axis.formName} · {axis.periodLabel}</p>
              <h2 className={`mt-1 ${typography.sectionTitle}`}>Eixo {axis.axisName}</h2>
              <p className={`mt-1 ${typography.sectionDescription}`}>
                {countLabel(axis.sections.length, "seção com plano", "seções com plano")}
              </p>
            </header>

            <div className="grid gap-4 xl:grid-cols-2">
              {axis.sections.map((section) => {
                const href = respondentSectionActionWorkspacePath(
                  section.sectionId,
                  section.cycleId,
                  "visao-geral",
                  { returnTo: returnPath },
                );
                const status = sectionPlanStatusFromMetrics(section.metrics);
                return (
                  <article key={section.key} className={`${formSurface.entityListCard} p-5 sm:p-6`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className={typography.contextLabel}>Seção {section.sectionDisplayNumber}</p>
                        <h3 className={`mt-1 ${typography.cardTitle}`}>{section.sectionName}</h3>
                      </div>
                      <SectionPlanStatusBadge status={status} />
                    </div>

                    <div className="mt-5">
                      <div className="mb-2 flex items-baseline justify-between gap-3">
                        <span className={typography.meta}>Execução da seção</span>
                        <span className="text-sm font-semibold tabular-nums text-slate-800">
                          {section.metrics.progressPercentage}%
                        </span>
                      </div>
                      <AdminActionPlanProgress
                        value={section.metrics.progressPercentage}
                        overdue={section.metrics.overdueActions > 0}
                        showLabel={false}
                      />
                    </div>

                    <dl className="mt-5 grid grid-cols-3 divide-x divide-slate-200 rounded-lg bg-slate-50/80 py-3 text-center">
                      <div className="min-w-0 px-2">
                        <dd className="text-lg font-semibold tabular-nums text-slate-900">{section.metrics.totalActions}</dd>
                        <dt className="mt-0.5 text-2xs text-slate-500">ações</dt>
                      </div>
                      <div className="min-w-0 px-2">
                        <dd className="text-lg font-semibold tabular-nums text-slate-900">{section.metrics.completedActions}</dd>
                        <dt className="mt-0.5 text-2xs text-slate-500">concluídas</dt>
                      </div>
                      <div className="min-w-0 px-2">
                        <dd className="text-lg font-semibold tabular-nums text-slate-900">{section.metrics.overdueActions}</dd>
                        <dt className="mt-0.5 text-2xs text-slate-500">em atraso</dt>
                      </div>
                    </dl>

                    <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className={typography.meta}>
                        {countLabel(
                          section.recommendations.length,
                          "recomendação de origem",
                          "recomendações de origem",
                        )}
                      </p>
                      <Link href={href} className={typography.inlineNavLink}>
                        Abrir plano da seção
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
