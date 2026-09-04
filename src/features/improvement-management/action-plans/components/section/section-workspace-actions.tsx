import Link from "next/link";
import { ListChecks } from "lucide-react";
import type { SectionActionPlanGroup } from "@/features/improvement-management/action-plans/section-action-plan-model";
import {
  actionNumberInSection,
  SECTION_PLAN_EMPTY,
} from "@/features/improvement-management/action-plans/section-action-plan-copy";
import { AdminActionPlanProgress } from "@/features/improvement-management/action-plans/components/admin/admin-action-plan-progress";
import { PlanStatusBadge } from "@/features/improvement-management/action-plans/components/shared/plan-status-badge";
import {
  SectionPlanStatusBadge,
  sectionPlanStatusFromMetrics,
} from "@/features/improvement-management/action-plans/components/section/section-plan-status-badge";
import {
  currentSectionWorkspacePath,
  recommendationWorkspacePath,
  type SectionActionPlanWorkspaceRole,
} from "@/features/improvement-management/action-plans/components/section/section-workspace-navigation";
import {
  originQuestionsHeading,
  RECOMMENDATION_CARD_LABELS,
} from "@/features/improvement-management/recommendations/components/respondent/recommendation-card-view-model";
import {
  OverviewBlockTitle,
  OverviewCardShell,
  OverviewSoftPanel,
  RecommendationCardField,
  RecommendationCardText,
  overviewStack,
} from "@/features/improvement-management/recommendations/components/hub/overview-section-primitives";
import { EmptyState } from "@/shared/ui/components/empty-state";
import { formSurface } from "@/shared/layout/form-surface";
import { formatLocalDate } from "@/shared/datetime/business-date";
import { getAxisTheme } from "@/shared/theme/axis-theme";

type Props = {
  role: SectionActionPlanWorkspaceRole;
  section: SectionActionPlanGroup;
  parentReturnTo?: string | null;
};

export function SectionWorkspaceActions({ role, section, parentReturnTo }: Props) {
  const returnPath = currentSectionWorkspacePath(role, section, "acoes", parentReturnTo);
  const sectionStatus = sectionPlanStatusFromMetrics(section.metrics);
  const axisTheme = getAxisTheme(section.axisName);

  return (
    <div className="space-y-8">
      <section aria-labelledby="section-execution-heading" className={overviewStack}>
        <OverviewBlockTitle
          id="section-execution-heading"
          title="Execução da seção"
          description="O percentual consolida apenas as ações ativas desta seção."
        />
        <OverviewSoftPanel className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <RecommendationCardField label={RECOMMENDATION_CARD_LABELS.progress}>
              <div className="flex items-center gap-3">
                <RecommendationCardText variant="meta" as="span" className="shrink-0 tabular-nums">
                  {section.metrics.progressPercentage}%
                </RecommendationCardText>
                <div className="w-full max-w-xs sm:w-72">
                  <AdminActionPlanProgress
                    value={section.metrics.progressPercentage}
                    size="md"
                    showLabel={false}
                  />
                </div>
              </div>
            </RecommendationCardField>
            <SectionPlanStatusBadge status={sectionStatus} />
          </div>
        </OverviewSoftPanel>
      </section>

      {section.actions.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={SECTION_PLAN_EMPTY.actionsTitle}
          description={SECTION_PLAN_EMPTY.actionsDescription}
        />
      ) : null}

      {section.recommendations.map((recommendation, recommendationIndex) => (
        <section key={recommendation.recommendationId} className={overviewStack}>
          <OverviewBlockTitle
            title={`Recomendação ${section.sectionDisplayNumber}.${recommendationIndex + 1}`}
          />
          <OverviewSoftPanel className="space-y-4">
            <RecommendationCardField label={RECOMMENDATION_CARD_LABELS.recommendation}>
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

            {recommendation.actions.length === 0 ? (
              <div className={`${formSurface.messageNeutral} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
                <span>Esta recomendação ainda não possui ação cadastrada.</span>
                {role === "respondent" ? (
                  <Link
                    className={`${formSurface.secondaryButtonSm} shrink-0`}
                    href={recommendationWorkspacePath(role, recommendation.recommendationId, "acoes", returnPath)}
                  >
                    Cadastrar ação
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                {recommendation.actions.map((action, actionIndex) => (
                  <OverviewCardShell key={action.id} accentColor={axisTheme.primary}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <RecommendationCardField
                          label={`Ação A${actionNumberInSection(section, recommendationIndex, actionIndex)}`}
                        >
                          <RecommendationCardText variant="highlight">
                            {action.actionText}
                          </RecommendationCardText>
                        </RecommendationCardField>
                        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                          <RecommendationCardField label="Responsável">
                            <RecommendationCardText>
                              {action.responsibleName || "Não informado"}
                            </RecommendationCardText>
                          </RecommendationCardField>
                          <RecommendationCardField label="Prazo">
                            <RecommendationCardText>
                              {formatLocalDate(action.dueDate)}
                            </RecommendationCardText>
                          </RecommendationCardField>
                        </dl>
                      </div>
                      <PlanStatusBadge status={action.status} />
                    </div>
                    <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <AdminActionPlanProgress
                        value={action.progressPercentage}
                        overdue={action.slaLabel === "overdue"}
                      />
                      <Link
                        className={formSurface.secondaryButtonSm}
                        href={recommendationWorkspacePath(role, recommendation.recommendationId, "acoes", returnPath)}
                      >
                        {role === "respondent" ? "Gerenciar ação" : "Ver ação"}
                      </Link>
                    </div>
                  </OverviewCardShell>
                ))}
              </div>
            )}
          </OverviewSoftPanel>
        </section>
      ))}
    </div>
  );
}
