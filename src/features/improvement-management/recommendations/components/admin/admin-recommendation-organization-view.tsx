"use client";

import { AdminMonitoringOrganizationSummary } from "@/features/improvement-management/monitoring/components/admin-monitoring-organization-summary";
import { AdminMonitoringOrganizationView } from "@/features/improvement-management/monitoring/components/admin-monitoring-organization-view";
import { AdminRecommendationList } from "@/features/improvement-management/recommendations/components/admin/admin-recommendation-list";
import {
  groupByOrganization,
  type AdminRecommendationItem,
  type OrganizationSummary,
} from "@/features/improvement-management/recommendations/admin-presentation";

type Props = {
  items: AdminRecommendationItem[];
  initiallyExpanded?: number;
  paginationResetKey?: string | number;
  serverPaginated?: boolean;
};

function averageProgress(rows: AdminRecommendationItem[]): number {
  if (rows.length === 0) return 0;
  return Math.round(
    rows.reduce((sum, row) => sum + row.progress, 0) / rows.length,
  );
}

function renderSummary(
  group: OrganizationSummary,
  rows: AdminRecommendationItem[],
) {
  return (
    <AdminMonitoringOrganizationSummary
      total={group.total}
      singular="recomendação"
      plural="recomendações"
      averageProgress={averageProgress(rows)}
      withoutPlan={group.withoutPlan}
      overdue={group.overdue}
    />
  );
}

export function AdminRecommendationOrganizationView(props: Props) {
  return (
    <AdminMonitoringOrganizationView
      {...props}
      groups={groupByOrganization(props.items)}
      getOrganizationId={(item) => item.organizationId}
      renderSummary={renderSummary}
      renderRows={(rows) => (
        <AdminRecommendationList items={rows} hideOrganization />
      )}
      ariaLabel="Recomendações por organização"
    />
  );
}
