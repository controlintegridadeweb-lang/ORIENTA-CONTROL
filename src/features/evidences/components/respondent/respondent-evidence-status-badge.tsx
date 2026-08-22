"use client";

import { WorkflowStatusBadge } from "@/shared/ui/components/workflow-status-badge";
import type { ValidationStatus } from "@/features/evidences/schemas";

type Props = {
  status: ValidationStatus;
  withIcon?: boolean;
  size?: "sm" | "md";
};

export function RespondentStatusBadge({
  status,
  withIcon = false,
  size = "sm",
}: Props) {
  return (
    <WorkflowStatusBadge
      domain="evidence_validation"
      status={status}
      size={size === "md" ? "md" : "default"}
      showIcon={withIcon}
    />
  );
}
