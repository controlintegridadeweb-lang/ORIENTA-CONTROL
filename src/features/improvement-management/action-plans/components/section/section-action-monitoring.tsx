"use client";

import { useMemo } from "react";
import type { SectionActionPlanGroup } from "@/features/improvement-management/action-plans/section-action-plan-model";
import type { SectionActionPlanWorkspaceRole } from "@/features/improvement-management/action-plans/components/section/section-workspace-navigation";
import { ActionMonitoringSummary } from "@/features/improvement-management/action-plans/components/monitoring/action-monitoring-summary";
import { AuditHistorySection } from "@/features/improvement-management/action-plans/components/monitoring/audit-history-section";
import { ExecutionProofsSection } from "@/features/improvement-management/action-plans/components/monitoring/execution-proofs-section";
import { MonitoringComposer } from "@/features/improvement-management/action-plans/components/monitoring/monitoring-composer";
import { PendingDecisionsSection } from "@/features/improvement-management/action-plans/components/monitoring/pending-decisions-section";
import { RecentActivitySection } from "@/features/improvement-management/action-plans/components/monitoring/recent-activity-section";
import { useActionMonitoringWorkspace } from "@/features/improvement-management/action-plans/components/monitoring/use-action-monitoring-workspace";
import { useMonitoredAction } from "@/features/improvement-management/action-plans/components/monitoring/use-monitored-action";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { layout } from "@/shared/layout/design-system";

type Props = {
  role: SectionActionPlanWorkspaceRole;
  section: SectionActionPlanGroup;
};

export function SectionActionMonitoring({ role, section }: Props) {
  const entries = useMemo(
    () =>
      section.recommendations.flatMap((recommendation) =>
        recommendation.actions.map((action) => ({
          action,
          recommendationId: recommendation.recommendationId,
        })),
      ),
    [section.recommendations],
  );
  const plans = useMemo(() => entries.map((entry) => entry.action), [entries]);
  const { selectedActionId, selectedPlan, selectAction } = useMonitoredAction(plans);
  const recommendationId = entries.find((entry) => entry.action.id === selectedActionId)?.recommendationId;
  const data = useActionMonitoringWorkspace({
    role,
    recommendationId,
    selectedActionId,
  });

  if (plans.length === 0) return null;

  return (
    <div className={`${layout.panelStack} gap-6`}>
      <ActionMonitoringSummary
        plans={plans}
        selectedPlan={selectedPlan}
        onSelectAction={selectAction}
        detailsHref={null}
      />

      {data.operationalError ? (
        <AsyncErrorState
          compact
          title="O acompanhamento pode estar desatualizado"
          message={data.operationalError}
          onRetry={data.retryOperational}
          retrying={data.operationalLoading}
        />
      ) : null}

      {role === "admin" && selectedPlan && recommendationId ? (
        <MonitoringComposer
          recommendationId={recommendationId}
          plan={selectedPlan}
          openRequestActionIds={data.openRequestActionIds}
          checkingOpenRequests={data.supervisionLoading}
          openRequestCheckError={data.supervisionError}
          onCreated={data.prependNote}
        />
      ) : null}

      <PendingDecisionsSection
        items={data.pendingItems}
        role={role}
        loading={data.operationalLoading}
        onDeadlineUpdated={data.replaceDeadline}
        onNoteUpdated={async (updated) => {
          data.replaceNote(updated);
          await data.refreshOpenRequests();
        }}
      />

      <RecentActivitySection items={data.progressUpdates} loading={data.operationalLoading} />

      {selectedPlan ? <ExecutionProofsSection plan={selectedPlan} consultHref={null} /> : null}

      <AuditHistorySection
        items={data.auditFeedItems}
        loading={data.auditLoading}
        error={data.auditError}
        total={data.auditTotal}
        offset={data.auditOffset}
        pageSize={data.auditPageSize}
        hasMore={data.auditHasMore}
        onRetry={data.retryAudit}
        onPrevious={data.previousAuditPage}
        onNext={data.nextAuditPage}
      />
    </div>
  );
}
