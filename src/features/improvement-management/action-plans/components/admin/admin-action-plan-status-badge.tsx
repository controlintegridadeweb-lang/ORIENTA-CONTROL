"use client";

import { WorkflowStatusBadge } from "@/shared/ui/components/workflow-status-badge";
import type { PlanStatus } from "@/features/improvement-management/action-plans/schemas";
import { StatusPill } from "@/shared/ui/components/status-pill";
import { formSurface } from "@/shared/layout/form-surface";
import type { AdminPlanView } from "@/features/improvement-management/action-plans/admin-monitoring";

type Props = {
  status?: PlanStatus;
  view?: AdminPlanView;
  withIcon?: boolean;
  size?: "sm" | "md";
};

export function AdminActionPlanStatusBadge({
  status,
  view,
  withIcon = false,
  size = "sm",
}: Props) {
  const resolved = status ?? view ?? "not_started";
  if (resolved === "overdue") {
    return <StatusPill className={formSurface.badge.danger}>Em atraso</StatusPill>;
  }
  return (
    <WorkflowStatusBadge
      domain="action_plan"
      status={resolved}
      size={size === "md" ? "md" : "default"}
      showIcon={withIcon}
    />
  );
}
