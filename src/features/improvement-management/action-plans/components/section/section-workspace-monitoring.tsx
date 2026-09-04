import {
  actionNumberInSection,
  SECTION_PLAN_EMPTY,
  sectionExecutionSituationSummary,
} from "@/features/improvement-management/action-plans/section-action-plan-copy";
import type { SectionActionPlanGroup } from "@/features/improvement-management/action-plans/section-action-plan-model";
import { ActionPlanMonitoringDashboard } from "@/features/improvement-management/action-plans/components/monitoring/action-plan-monitoring-dashboard";
import { ActionSupervisionCard } from "@/features/improvement-management/action-plans/components/monitoring/action-supervision-card";
import {
  currentSectionWorkspacePath,
  recommendationWorkspacePath,
  type SectionActionPlanWorkspaceRole,
} from "@/features/improvement-management/action-plans/components/section/section-workspace-navigation";
import { RECOMMENDATION_CARD_LABELS } from "@/features/improvement-management/recommendations/components/respondent/recommendation-card-view-model";
import {
  OverviewBlockTitle,
  OverviewMetaGrid,
  OverviewMetaItem,
  OverviewSoftPanel,
  overviewStack,
} from "@/features/improvement-management/recommendations/components/hub/overview-section-primitives";
import { EmptyState } from "@/shared/ui/components/empty-state";
import { getAxisTheme } from "@/shared/theme/axis-theme";

type Props = {
  role: SectionActionPlanWorkspaceRole;
  section: SectionActionPlanGroup;
  parentReturnTo?: string | null;
};

export function SectionWorkspaceMonitoring({ role, section, parentReturnTo }: Props) {
  const returnPath = currentSectionWorkspacePath(role, section, "monitoramento", parentReturnTo);
  const axisTheme = getAxisTheme(section.axisName);
  const situation = sectionExecutionSituationSummary(section);

  return (
    <div className="space-y-8">
      {role === "admin" ? (
        <ActionPlanMonitoringDashboard
          items={section.recommendations.flatMap((recommendation, recommendationIndex) =>
            recommendation.actions.map((action, actionIndex) => ({
              action,
              label: `A${actionNumberInSection(section, recommendationIndex, actionIndex)}`,
            })),
          )}
          description="Leitura gráfica da seção: situação, execução média e progresso de cada ação."
        />
      ) : (
        <section aria-labelledby="section-monitoring-heading" className={overviewStack}>
          <OverviewBlockTitle
            id="section-monitoring-heading"
            title="Monitoramento"
            description="Acompanhamento das ações desta seção. Histórico, solicitações de prazo e decisões permanecem no monitoramento canônico da ação."
          />
          <OverviewSoftPanel>
            <OverviewMetaGrid>
              <OverviewMetaItem label={RECOMMENDATION_CARD_LABELS.situation} value={situation} />
              <OverviewMetaItem
                label={RECOMMENDATION_CARD_LABELS.progress}
                value={`${section.metrics.progressPercentage}% executado`}
              />
              <OverviewMetaItem label="Concluídas" value={String(section.metrics.completedActions)} />
              <OverviewMetaItem label="Em atraso" value={String(section.metrics.overdueActions)} />
            </OverviewMetaGrid>
          </OverviewSoftPanel>
        </section>
      )}

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
              recommendation.actions.map((action, actionIndex) => (
                <ActionSupervisionCard
                  key={action.id}
                  action={action}
                  actionLabel={`Ação A${actionNumberInSection(section, recommendationIndex, actionIndex)}`}
                  originText={recommendation.recommendationText}
                  accentColor={axisTheme.primary}
                  href={recommendationWorkspacePath(
                    role,
                    recommendation.recommendationId,
                    "monitoramento",
                    returnPath,
                  )}
                />
              )),
            )}
          </div>
        )}
      </section>
    </div>
  );
}
