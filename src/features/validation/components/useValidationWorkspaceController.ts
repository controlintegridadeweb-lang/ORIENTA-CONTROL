"use client";

import type {
  AbsentProofDecisionAction,
  EvidenceDecisionAction,
  NotApplicableDecisionAction,
  UnifiedFormCriterion,
} from "../contracts";
import type {
  ValidationBatchCommand,
  ValidationBatchExecutionResult,
} from "../batch-actions";
import {
  QUEUE_SITUATION_FILTER_LABEL,
  type QueueSituationFilter,
} from "../form-view-model";
import type { ValidationPageSize } from "../pagination";
import type {
  QueueEvidence,
  QueueNotApplicable,
  QueueProgress,
  QueueSectionSummary,
} from "../queue-model";
import { useValidationBatchController } from "./useValidationBatchController";
import { useValidationCompletionActions } from "./use-validation-completion-actions";
import { useValidationCriteriaState } from "./use-validation-criteria-state";
import { useValidationQueueNavigation } from "./use-validation-queue-navigation";

export type ValidationWorkspaceCallbacks = {
  onVerdict: (
    evidence: QueueEvidence,
    action: EvidenceDecisionAction,
    justification: string,
  ) => Promise<QueueEvidence | null>;
  onNaVerdict: (
    item: QueueNotApplicable,
    action: NotApplicableDecisionAction,
    rejectionReason: string,
  ) => Promise<QueueNotApplicable | null>;
  onMarkAdminNotApplicable?: (
    responseId: string,
    justification: string,
  ) => Promise<void>;
  onAbsentProofDecision?: (
    responseId: string,
    action: AbsentProofDecisionAction,
    observation: string,
  ) => Promise<void>;
  onRevertAdminNotApplicable?: (
    responseId: string,
    justification: string,
  ) => Promise<void>;
  onApplyBatch: (
    command: ValidationBatchCommand,
  ) => Promise<ValidationBatchExecutionResult>;
  onDispatchAdjustments: () => Promise<{
    adjustmentCount: number;
    proofRequestCount?: number;
    totalCount?: number;
  }>;
  onConsolidate: () => Promise<void>;
};

export type ValidationWorkspaceInput = ValidationWorkspaceCallbacks & {
  cycleId: string;
  returnTo?: string | null;
  targetEvidenceId?: string | null;
  initialCriteria: UnifiedFormCriterion[];
  formSections: QueueSectionSummary[];
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
  flushPendingAutosave?: () => Promise<void>;
  hasUnconfirmedAutosave?: boolean;
};

export function useValidationWorkspaceController(
  input: ValidationWorkspaceInput,
) {
  const criteriaState = useValidationCriteriaState(input.initialCriteria);
  const navigation = useValidationQueueNavigation({
    cycleId: input.cycleId,
    returnTo: input.returnTo,
    targetEvidenceId: input.targetEvidenceId,
    formSections: input.formSections,
    pagination: input.pagination,
  });
  const completion = useValidationCompletionActions({
    locked: criteriaState.itemPending,
    progress: input.progress,
    onDispatchAdjustments: input.onDispatchAdjustments,
    onConsolidate: input.onConsolidate,
    flushPendingAutosave: input.flushPendingAutosave,
    hasUnconfirmedAutosave: input.hasUnconfirmedAutosave,
  });
  const baseQueueLocked = criteriaState.itemPending || completion.busy;
  const batch = useValidationBatchController({
    cycleId: input.cycleId,
    criteria: criteriaState.criteria,
    disabled: baseQueueLocked,
    onApplyBatch: input.onApplyBatch,
    onRefresh: criteriaState.refreshAndFocus,
  });
  const queueLocked = baseQueueLocked || batch.pending;

  async function handleVerdict(
    evidenceId: string,
    action: EvidenceDecisionAction,
    justification: string,
  ) {
    const evidence = criteriaState.criteria
      .flatMap((criterion) => criterion.evidenceGroup?.documents ?? [])
      .find((item) => item.id === evidenceId);
    if (!evidence) return;
    await criteriaState.withItemPending(queueLocked, async () => {
      await input.onVerdict(evidence, action, justification);
    });
  }

  async function handleNaVerdict(
    responseId: string,
    action: NotApplicableDecisionAction,
    rejectionReason: string,
  ) {
    const item = criteriaState.criteria.find(
      (criterion) => criterion.responseId === responseId,
    )?.notApplicableItem;
    if (!item) return;
    await criteriaState.withItemPending(queueLocked, async () => {
      await input.onNaVerdict(item, action, rejectionReason);
    });
  }

  async function handleOptionalCommand(
    command: ((responseId: string, value: string) => Promise<void>) | undefined,
    responseId: string,
    value: string,
  ) {
    if (!command) return;
    await criteriaState.withItemPending(queueLocked, () =>
      command(responseId, value),
    );
  }

  async function handleAbsentProofDecision(
    responseId: string,
    action: AbsentProofDecisionAction,
    observation: string,
  ) {
    if (!input.onAbsentProofDecision) return;
    await criteriaState.withItemPending(queueLocked, () =>
      input.onAbsentProofDecision!(responseId, action, observation),
    );
  }

  return {
    criteria: criteriaState.criteria,
    targetEvidenceId: input.targetEvidenceId ?? null,
    queueSituation: navigation.queueSituation,
    queueSituationLabel:
      QUEUE_SITUATION_FILTER_LABEL[navigation.queueSituation],
    searchDraft: navigation.searchDraft,
    setSearchDraft: navigation.setSearchDraft,
    batchMode: batch.batchMode,
    toggleBatchMode: batch.toggleBatchMode,
    selectedEvidenceIds: batch.selectedEvidenceIds,
    selectedNaIds: batch.selectedNaIds,
    selectedCount: batch.selectedCount,
    batchSelection: batch.selection,
    batchPending: batch.pending,
    batchError: batch.error,
    clearBatchSelection: batch.clearSelection,
    toggleCriterionSelection: batch.toggleCriterionSelection,
    isCriterionBatchSelectable: batch.isCriterionSelectable,
    applyBatch: batch.applyBatch,
    page: navigation.page,
    pageSize: navigation.pageSize,
    totalItems: navigation.totalItems,
    safePage: navigation.safePage,
    selectedAxisId: navigation.selectedAxisId,
    selectedSectionId: navigation.selectedSectionId,
    selectedSection: navigation.selectedSection,
    sectionNav: navigation.sectionNav,
    queueLocked,
    cycleHref: navigation.cycleHref,
    fullFormHref: navigation.fullFormHref,
    replaceParams: navigation.replaceParams,
    clearFilters: navigation.clearFilters,
    handleVerdict,
    handleNaVerdict,
    handleMarkAdminNotApplicable: (
      responseId: string,
      justification: string,
    ) =>
      handleOptionalCommand(
        input.onMarkAdminNotApplicable,
        responseId,
        justification,
      ),
    handleAbsentProofDecision,
    handleRevertAdminNotApplicable: (
      responseId: string,
      justification: string,
    ) =>
      handleOptionalCommand(
        input.onRevertAdminNotApplicable,
        responseId,
        justification,
      ),
    dispatchingAdjustments: completion.dispatchingAdjustments,
    adjustmentDispatchError: completion.adjustmentDispatchError,
    consolidating: completion.consolidating,
    consolidationError: completion.consolidationError,
    itemPending: criteriaState.itemPending,
    handleDispatchAdjustments: completion.handleDispatchAdjustments,
    handleConsolidate: completion.handleConsolidate,
  };
}
