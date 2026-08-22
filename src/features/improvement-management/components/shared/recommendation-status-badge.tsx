"use client";

import { WorkflowStatusBadge } from "@/shared/ui/components/workflow-status-badge";
import type { RecommendationStatus } from "@/features/improvement-management/recommendations/schemas";

type Props = {
  status: RecommendationStatus;
  withIcon?: boolean;
  size?: "sm" | "md";
};

export function RecommendationStatusBadge({ status, withIcon = false, size = "sm" }: Props) {
  return (
    <WorkflowStatusBadge
      domain="recommendation"
      status={status}
      size={size === "md" ? "md" : "default"}
      showIcon={withIcon}
    />
  );
}
