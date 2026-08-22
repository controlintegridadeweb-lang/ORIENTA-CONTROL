"use client";

import { WorkflowStatusBadge } from "@/shared/ui/components/workflow-status-badge";
import { EVIDENCE_VALIDATION_REGISTRY } from "@/shared/ui/status-registry";
import type { ValidationStatus } from "@/features/evidences/schemas";

export const STATUS_LABELS: Record<ValidationStatus, string> = Object.fromEntries(
  (Object.keys(EVIDENCE_VALIDATION_REGISTRY) as ValidationStatus[]).map((k) => [
    k,
    EVIDENCE_VALIDATION_REGISTRY[k].label,
  ]),
) as Record<ValidationStatus, string>;

export function StatusBadge({ status }: { status: ValidationStatus }) {
  return (
    <WorkflowStatusBadge
      domain="evidence_validation"
      status={status}
      ariaPrefix="Situação da evidência"
    />
  );
}
