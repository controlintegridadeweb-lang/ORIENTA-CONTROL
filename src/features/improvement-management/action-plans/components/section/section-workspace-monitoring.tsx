import Link from "next/link";
import type { SectionActionPlanGroup } from "@/features/improvement-management/action-plans/section-action-plan-model";
import {
  actionNumberInSection,
  SECTION_PLAN_EMPTY,
  sectionExecutionSituationSummary,
} from "@/features/improvement-management/action-plans/section-action-plan-copy";
import { AdminActionPlanProgress } from "@/features/improvement-management/action-plans/components/admin/admin-action-plan-progress";
import { PlanStatusBadge } from "@/features/improvement-management/action-plans/components/shared/plan-status-badge";
import { summarizeActionDocuments } from "@/features/improvement-management/action-plans/monitoring/summarize-action-documents";
import {
  currentSectionWorkspacePath,
  recommendationWorkspacePath,
  type SectionActionPlanWorkspaceRole,
} from "@/features/improvement-management/action-plans/components/section/section-workspace-navigation";
import { RECOMMENDATION_CARD_LABELS } from "@/features/improvement-management/recommendations/components/respondent/recommendation-card-view-model";
import {
  OverviewBlockTitle,
  OverviewCardShell,
  OverviewMetaGrid,
  OverviewMetaItem,
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

export function SectionWorkspaceMonitoring({ role, section, parentReturnTo }: Props) {
  const returnPath = currentSectionWorkspacePath(role, section, "monitoramento", parentReturnTo);
  const axisTheme = getAxisTheme(section.axisName);

  return (
    <div className="space-y-8">
      <section aria-labelledby="section-monitoring-heading" className={overviewStack}>
        <OverviewBlockTitle
          id="section-monitoring-heading"
          title="Monitoramento"
          description="Acompanhamento das ações desta seção. Histórico, solicitações de prazo e decisões permanecem no monitoramento canônico da ação."
        />
        <OverviewSoftPanel>
          <OverviewMetaGrid>
            <OverviewMetaItem
              label={RECOMMENDATION_CARD_LABELS.situation}
              value={sectionExecutionSituationSummary(section)}
            />
            <OverviewMetaItem
              label={RECOMMENDATION_CARD_LABELS.progress}
              value={`${section.metrics.progressPercentage}% executado`}
            />
            <OverviewMetaItem label="Concluídas" value={String(section.metrics.completedActions)} />
            <OverviewMetaItem label="Em atraso" value={String(section.metrics.overdueActions)} />
          </OverviewMetaGrid>
        </OverviewSoftPanel>
      </section>

      <section aria-labelledby="section-supervision-heading" className={overviewStack}>
        <OverviewBlockTitle
          id="section-supervision-heading"
          title="Supervisão por ação"
          description="Status, prazo, responsável e comprovações apenas das ações desta seção."
        />
        {section.actions.length === 0 ? (
          <EmptyState
            title={SECTION_PLAN_EMPTY.monitoringTitle}
            description={SECTION_PLAN_EMPTY.monitoringDescription}
          />
        ) : (
          <div className="space-y-3">
            {section.recommendations.flatMap((recommendation, recommendationIndex) =>
              recommendation.actions.map((action, actionIndex) => {
                const documents = summarizeActionDocuments(action.documents);
                return (
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
                        <RecommendationCardText variant="metaSecondary" className="mt-2">
                          Origem: {recommendation.recommendationText}
                        </RecommendationCardText>
                      </div>
                      <PlanStatusBadge status={action.status} />
                    </div>
                    <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                      <RecommendationCardField label="Responsável">
                        <RecommendationCardText>
                          {action.responsibleName || "Não informado"}
                        </RecommendationCardText>
                      </RecommendationCardField>
                      <RecommendationCardField label="Prazo">
                        <RecommendationCardText>{formatLocalDate(action.dueDate)}</RecommendationCardText>
                      </RecommendationCardField>
                      <RecommendationCardField label="Comprovações">
                        <RecommendationCardText>
                          {documents.line ?? "Nenhuma comprovação"}
                        </RecommendationCardText>
                      </RecommendationCardField>
                    </dl>
                    <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <AdminActionPlanProgress
                        value={action.progressPercentage}
                        overdue={action.slaLabel === "overdue"}
                      />
                      <Link
                        className={`${formSurface.secondaryButtonSm} shrink-0`}
                        href={recommendationWorkspacePath(
                          role,
                          recommendation.recommendationId,
                          "monitoramento",
                          returnPath,
                        )}
                      >
                        Abrir monitoramento
                      </Link>
                    </div>
                  </OverviewCardShell>
                );
              }),
            )}
          </div>
        )}
      </section>
    </div>
  );
}
