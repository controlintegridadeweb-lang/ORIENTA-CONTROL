"use client";

import { AdminMonitoringOrganizationSummary } from "@/features/improvement-management/monitoring/components/admin-monitoring-organization-summary";
import { AdminMonitoringOrganizationView } from "@/features/improvement-management/monitoring/components/admin-monitoring-organization-view";
import { AdminActionPlanList } from "@/features/improvement-management/action-plans/components/admin/admin-action-plan-list";
import {
  groupByOrganization,
  type AdminPlanItem,
  type OrganizationSummary,
} from "@/features/improvement-management/action-plans/admin-monitoring";

type Props = {
  items: AdminPlanItem[];
  initiallyExpanded?: number;
  paginationResetKey?: string | number;
  serverPaginated?: boolean;
};

function renderSummary(group: OrganizationSummary) {
  return (
    <AdminMonitoringOrganizationSummary
      total={group.total}
      singular="ação"
      plural="ações"
      averageProgress={group.averageProgress}
      withoutPlan={group.withoutPlan}
      overdue={group.overdue}
    />
  );
}

export function AdminActionPlanOrganizationView(props: Props) {
  return (
    <AdminMonitoringOrganizationView
      {...props}
      groups={groupByOrganization(props.items)}
      getOrganizationId={(item) => item.organizationId}
      renderSummary={renderSummary}
      renderRows={(rows) => (
        <AdminActionPlanList items={rows} hideOrganization />
      )}
      ariaLabel="Planos de integridade e compliance por organização"
    />
  );
}
