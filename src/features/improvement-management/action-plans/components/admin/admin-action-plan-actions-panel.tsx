"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ActionPlanActionList,
} from "@/features/improvement-management/action-plans/components/execution/action-plan-action-list";
import { useActionWorkspacePanel } from "@/features/improvement-management/action-plans/components/execution/use-action-workspace-panel";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { useRecommendationDetailContext } from "@/features/improvement-management/recommendations/components/hub/recommendation-detail-context";
import { OverviewBlockTitle } from "@/features/improvement-management/recommendations/components/hub/overview-section-primitives";
import { isActionPlanEligible } from "@/shared/domain/workflow";
import { actionPlanAvailabilityForCycleState } from "@/features/improvement-management/action-plans/availability";
import { formSurface } from "@/shared/layout/form-surface";
import { layout } from "@/shared/layout/design-system";
import { EmptyState } from "@/shared/ui/components/empty-state";
import { ClipboardList } from "lucide-react";

export function AdminActionPlanAcoesPanel() {
  const ctx = useRecommendationDetailContext();
  const row = ctx.row;
  const plans = useMemo(() => row?.plans ?? [], [row]);
  const planIds = useMemo(() => new Set(plans.map((plan) => plan.id)), [plans]);
  const { panel, setPanel } = useActionWorkspacePanel(planIds);

  if (!row) return null;

  const availability = actionPlanAvailabilityForCycleState(row.cycleState);

  if (!isActionPlanEligible(row.cycleState) && availability) {
    return (
      <PanelSection
        title={availability.title}
        description={availability.description}
        variant="plain"
      >
        <div className={`${formSurface.dashboardPanel} ${formSurface.dashboardPanelPadding}`}>
          <Link
            href={`/admin/ciclos/${encodeURIComponent(row.cycleId ?? "")}`}
            className={formSurface.secondaryButtonSm}
          >
            Acompanhar diagnóstico
          </Link>
        </div>
      </PanelSection>
    );
  }

  return (
    <div className={layout.panelStack}>
      <section aria-labelledby="admin-rec-actions-heading" className="space-y-4">
        <OverviewBlockTitle
          id="admin-rec-actions-heading"
          title="Ações do plano"
          description="Ações, responsáveis, prazos, progresso e histórico completo de cada ação."
        />
        {plans.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Nenhuma ação cadastrada"
            description="A organização ainda não vinculou ações a esta recomendação."
          />
        ) : (
          <ActionPlanActionList
            plans={plans}
            recommendationId={row.recommendationId}
            role="admin"
            panel={panel}
            deletingId={null}
            responsibleMembers={[]}
            responsibleMembersLoading={false}
            responsibleMembersError={null}
            onPanelChange={setPanel}
            onSaved={async () => {
              await ctx.refetch();
            }}
            onRetryResponsibleMembers={() => undefined}
            onEvidenceChanged={ctx.refetch}
          />
        )}
      </section>
    </div>
  );
}
