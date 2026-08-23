"use client";

import { useMemo } from "react";
import { layout } from "@/shared/layout/design-system";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { useRecommendationDetailContext } from "@/features/improvement-management/recommendations/components/hub/recommendation-detail-context";
import { MonitoringEmptyState } from "@/features/improvement-management/recommendations/components/hub/monitoring-empty-state";
import { actionWorkspaceHref } from "@/features/improvement-management/action-plans/action-workspace-href";
import { ActionMonitoringSummary } from "@/features/improvement-management/action-plans/components/monitoring/action-monitoring-summary";
import { MonitoringOrganogram } from "@/features/improvement-management/action-plans/components/monitoring/monitoring-organogram";
import { PendingDecisionsSection } from "@/features/improvement-management/action-plans/components/monitoring/pending-decisions-section";
import { MonitoringComposer } from "@/features/improvement-management/action-plans/components/monitoring/monitoring-composer";
import { RecentActivitySection } from "@/features/improvement-management/action-plans/components/monitoring/recent-activity-section";
import { ExecutionProofsSection } from "@/features/improvement-management/action-plans/components/monitoring/execution-proofs-section";
import { AuditHistorySection } from "@/features/improvement-management/action-plans/components/monitoring/audit-history-section";
import { useActionMonitoringWorkspace } from "@/features/improvement-management/action-plans/components/monitoring/use-action-monitoring-workspace";
import { useMonitoredAction } from "@/features/improvement-management/action-plans/components/monitoring/use-monitored-action";

type Props = {
  role: "admin" | "respondent";
};

export function ActionMonitoringWorkspace({ role }: Props) {
  const context = useRecommendationDetailContext();
  const { row, adminItem, detailBasePath, actionsTabHrefSegment } = context;
  const plans = useMemo(() => row?.plans ?? [], [row?.plans]);
  const { selectedActionId, selectedPlan, selectAction } = useMonitoredAction(plans);
  const data = useActionMonitoringWorkspace({
    role,
    recommendationId: row?.recommendationId,
    selectedActionId,
  });

  if (!row) return null;
  if (role === "admin" && !adminItem) return null;
  if (plans.length === 0) return <MonitoringEmptyState />;

  const detailsHref = selectedActionId
    ? actionWorkspaceHref({
        detailBasePath,
        actionsTabHrefSegment,
        planId: selectedActionId,
      })
    : null;
  const evidenceHref = selectedActionId
    ? actionWorkspaceHref({
        detailBasePath,
        actionsTabHrefSegment,
        planId: selectedActionId,
        panel: "evidence",
      })
    : null;

  return (
    <div className={`${layout.panelStack} gap-6`}>
      <MonitoringOrganogram
        axisName={row.axisName}
        sectionName={row.sectionName}
        recommendationText={row.recommendationText}
        plans={plans}
        selectedPlanId={selectedPlan?.id ?? null}
        onSelectAction={selectAction}
      />
      <ActionMonitoringSummary
        plans={plans}
        selectedPlan={selectedPlan}
        onSelectAction={selectAction}
        detailsHref={detailsHref}
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

      {role === "admin" && selectedPlan ? (
        <MonitoringComposer
          recommendationId={row.recommendationId}
          plan={selectedPlan}
          openRequestActionIds={data.openRequestActionIds}
          checkingOpenRequests={data.supervisionLoading}
          openRequestCheckError={data.supervisionError}
          onCreated={(created) => {
            data.prependNote(created);
            void context.refetch();
          }}
        />
      ) : null}

      <PendingDecisionsSection
        items={data.pendingItems}
        role={role}
        loading={data.operationalLoading}
        onDeadlineUpdated={async (updated) => {
          data.replaceDeadline(updated);
          await context.refetch();
        }}
        onNoteUpdated={async (updated) => {
          data.replaceNote(updated);
          await data.refreshOpenRequests();
        }}
      />

      <RecentActivitySection
        items={data.progressUpdates}
        loading={data.operationalLoading}
      />

      {selectedPlan ? (
        <ExecutionProofsSection plan={selectedPlan} consultHref={evidenceHref} />
      ) : null}

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
