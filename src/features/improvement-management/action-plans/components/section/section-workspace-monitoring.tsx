import {
  actionNumberInSection,
  SECTION_PLAN_EMPTY,
  sectionExecutionSituationSummary,
} from "@/features/improvement-management/action-plans/section-action-plan-copy";
import type { SectionActionPlanGroup } from "@/features/improvement-management/action-plans/section-action-plan-model";
import { ActionPlanMonitoringDashboard } from "@/features/improvement-management/action-plans/components/monitoring/action-plan-monitoring-dashboard";
import { SectionActionMonitoring } from "@/features/improvement-management/action-plans/components/section/section-action-monitoring";
import type { SectionActionPlanWorkspaceRole } from "@/features/improvement-management/action-plans/components/section/section-workspace-navigation";
import { RECOMMENDATION_CARD_LABELS } from "@/features/improvement-management/recommendations/components/respondent/recommendation-card-view-model";
import {
  OverviewBlockTitle,
  OverviewMetaGrid,
  OverviewMetaItem,
  OverviewSoftPanel,
  overviewStack,
} from "@/features/improvement-management/recommendations/components/hub/overview-section-primitives";
import { EmptyState } from "@/shared/ui/components/empty-state";

type Props = {
  role: SectionActionPlanWorkspaceRole;
  section: SectionActionPlanGroup;
  parentReturnTo?: string | null;
};

export function SectionWorkspaceMonitoring({ role, section }: Props) {
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
            description="Acompanhamento das ações desta seção, com a situação da ação e a conversa com a supervisão."
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

      {section.actions.length === 0 ? (
        <EmptyState
          title={SECTION_PLAN_EMPTY.monitoringTitle}
          description={SECTION_PLAN_EMPTY.monitoringDescription}
        />
      ) : (
        <SectionActionMonitoring role={role} section={section} />
      )}
    </div>
  );
}
