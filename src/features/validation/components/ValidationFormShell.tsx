"use client";

import { useRouter } from "next/navigation";
import type { UnifiedFormCriterion } from "@/features/validation";
import type {
  QueueEvidence,
  QueueNotApplicable,
  QueueProgress,
  QueueSectionSummary,
} from "@/features/validation/queue-model";
import type {
  FormViewSummary,
  QueueSituationFilter,
} from "@/features/validation/form-view-model";
import type { ValidationPageSize } from "@/features/validation/pagination";
import type {
  ValidationBatchCommand,
  ValidationBatchExecutionResult,
} from "@/features/validation/batch-actions";
import {
  consolidateAdminCycleValidation,
  dispatchAdminEvidenceAdjustments,
  decideAdminProofAction,
  markAdminNotApplicableAction,
  markAdminNotApplicableBatch,
  revertAdminNotApplicableAction,
  validateEvidenceAction,
  validateQueueBatch,
  validateNotApplicableAction,
} from "@/features/cycles";
import { ValidationFormView } from "./ValidationFormView";

type EvidenceAction = "approve" | "invalidate" | "request_adjustment";
type NaAction = "approve" | "reject";

export function ValidationFormShell({
  cycleId,
  organizationName,
  formName,
  periodLabel,
  returnTo,
  initialCriteria,
  formSummary,
  formSections,
  validationReopened = false,
  targetEvidenceId,
  pagination,
  progress,
}: {
  cycleId: string;
  organizationName: string;
  formName: string;
  periodLabel: string;
  returnTo?: string | null;
  initialCriteria: UnifiedFormCriterion[];
  formSummary: FormViewSummary;
  formSections: QueueSectionSummary[];
  validationReopened?: boolean;
  targetEvidenceId?: string | null;
  pagination: {
    page: number;
    pageSize: ValidationPageSize;
    totalItems: number;
    sectionId: string | null;
    axisId: string | null;
    queueSituation: QueueSituationFilter;
    search: string;
  };
  progress: QueueProgress;
}) {
  const router = useRouter();

  async function onVerdict(
    evidence: QueueEvidence,
    action: EvidenceAction,
    justification: string,
  ): Promise<QueueEvidence | null> {
    try {
      if (
        evidence.absentEvidence ||
        evidence.status === "not_presented" ||
        evidence.status === "validated_without_proof" ||
        evidence.status === "proof_requested" ||
        evidence.status === "considered_insufficient"
      ) {
        throw new Error(
          "Critério sem comprovação apresentada não recebe veredito por evidência.",
        );
      }
      const result = await validateEvidenceAction(cycleId, evidence.id, {
        action,
        justification: justification.trim() || null,
        expectedStatus: evidence.status,
        expectedValidatedAt: evidence.validatedAt ?? null,
      });

      return {
        ...evidence,
        status: result.validationStatus,
        justification: action === "approve" ? null : justification.trim(),
        validatedAt: result.validatedAt,
      };
    } catch (error) {
      router.refresh();
      throw error;
    }
  }

  async function onNaVerdict(
    item: QueueNotApplicable,
    action: NaAction,
    rejectionReason: string,
  ): Promise<QueueNotApplicable | null> {
    try {
      const result = await validateNotApplicableAction(cycleId, item.id, {
        action,
        rejectionReason: rejectionReason.trim() || null,
        expectedStatus: item.status,
        expectedValidatedAt:
          item.status === "pending" ? null : item.validatedAt ?? null,
      });

      return {
        ...item,
        status: result.naValidationStatus,
        rejectionReason: action === "reject" ? rejectionReason.trim() : null,
        validatedAt: result.validatedAt,
      };
    } catch (error) {
      router.refresh();
      throw error;
    }
  }

  async function onMarkAdminNotApplicable(
    responseId: string,
    justification: string,
  ): Promise<void> {
    try {
      await markAdminNotApplicableAction(cycleId, responseId, { justification });
      router.refresh();
    } catch (error) {
      router.refresh();
      throw error;
    }
  }

  async function onAbsentProofDecision(
    responseId: string,
    action:
      | "validate_without_proof"
      | "request_proof"
      | "consider_insufficient",
    observation: string,
  ): Promise<void> {
    try {
      await decideAdminProofAction(cycleId, responseId, {
        action,
        observation,
      });
      router.refresh();
    } catch (error) {
      router.refresh();
      throw error;
    }
  }

  async function onRevertAdminNotApplicable(
    responseId: string,
    justification: string,
  ): Promise<void> {
    try {
      await revertAdminNotApplicableAction(cycleId, responseId, {
        justification,
      });
    } catch (error) {
      router.refresh();
      throw error;
    }
  }


  async function onApplyBatch(
    command: ValidationBatchCommand,
  ): Promise<ValidationBatchExecutionResult> {
    if (command.kind === "admin_not_applicable") {
      return markAdminNotApplicableBatch(cycleId, {
        responseIds: command.responseIds,
        justification: command.justification,
      });
    }
    return validateQueueBatch(cycleId, command);
  }

  async function onDispatchAdjustments() {
    const result = await dispatchAdminEvidenceAdjustments(cycleId);
    const params = new URLSearchParams({ validation: "adjustment_requested" });
    if (returnTo) params.set("returnTo", returnTo);
    router.replace(`/admin/ciclos/${cycleId}?${params.toString()}`);
    return result;
  }

  async function onConsolidate() {
    await consolidateAdminCycleValidation(cycleId);
    const params = new URLSearchParams({ validation: "consolidated" });
    if (returnTo) params.set("returnTo", returnTo);
    router.replace(`/admin/ciclos/${cycleId}?${params.toString()}`);
  }

  return (
    <ValidationFormView
      cycleId={cycleId}
      organizationName={organizationName}
      formName={formName}
      periodLabel={periodLabel}
      returnTo={returnTo}
      initialCriteria={initialCriteria}
      formSummary={formSummary}
      formSections={formSections}
      validationReopened={validationReopened}
      targetEvidenceId={targetEvidenceId}
      pagination={pagination}
      progress={progress}
      onVerdict={onVerdict}
      onNaVerdict={onNaVerdict}
      onMarkAdminNotApplicable={onMarkAdminNotApplicable}
      onAbsentProofDecision={onAbsentProofDecision}
      onRevertAdminNotApplicable={onRevertAdminNotApplicable}
      onApplyBatch={onApplyBatch}
      onDispatchAdjustments={onDispatchAdjustments}
      onConsolidate={onConsolidate}
    />
  );
}
