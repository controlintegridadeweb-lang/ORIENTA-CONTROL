"use client";

import { useCallback, useMemo, useState } from "react";
import { useWorkbenchNavigation } from "@/features/workbench/use-workbench-navigation";
import { unresolvedAdjustmentRows } from "@/features/workbench/adjustment-progress";
import { usePersistedWorkbenchSection } from "./use-persisted-workbench-section";
import { useWorkbenchAnswerFlow } from "./use-workbench-answer-flow";
import { useWorkbenchEvidence } from "./use-workbench-evidence";
import type { UseWorkbenchParams } from "./workbench-types";
import { useWorkbenchResource } from "./use-workbench-resource";
import { useWorkbenchSectionActions } from "./use-workbench-section-actions";
import { useWorkbenchSubmission } from "./use-workbench-submission";
import { useWorkbenchRealtime } from "./use-workbench-realtime";
import { scrollToWorkbenchTarget } from "./scroll-workbench-target";

export function useWorkbench({
  mode,
  ids,
  canAutoLoad,
  simplifiedRespondent,
  initialFocusQuestionId,
  submissionReturnTo,
}: UseWorkbenchParams) {
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const resource = useWorkbenchResource({
    ids,
    canAutoLoad,
    simplifiedRespondent,
  });

  const preferredAdjustmentQuestionId =
    resource.data?.cycle.state === "awaiting_adjustment" && !initialFocusQuestionId
      ? unresolvedAdjustmentRows(resource.data.rows)[0]?.questionId
      : undefined;
  const activeNavigation = useWorkbenchNavigation({
    rows: resource.data?.rows ?? [],
    initialFocusQuestionId,
    preferredQuestionId: preferredAdjustmentQuestionId,
    scopeKey: ids.cycleId,
  });

  usePersistedWorkbenchSection({
    cycleId: ids.cycleId,
    enabled:
      simplifiedRespondent &&
      !initialFocusQuestionId &&
      resource.data?.cycle.state !== "awaiting_adjustment",
    sectionCount: activeNavigation.groupedBySection.length,
    currentSectionIndex: activeNavigation.currentSectionIndex,
    setCurrentSectionIndex: activeNavigation.setCurrentSectionIndex,
  });

  const rowByQuestionId = useMemo(
    () => new Map((resource.data?.rows ?? []).map((row) => [row.questionId, row])),
    [resource.data?.rows],
  );
  const resolveRow = useCallback(
    (questionId: string) => rowByQuestionId.get(questionId),
    [rowByQuestionId],
  );

  const evidence = useWorkbenchEvidence({
    ids,
    loadWorkbench: resource.loadWorkbench,
    setFeedback: resource.setFeedback,
    setSavingQuestionId,
  });
  const answerFlow = useWorkbenchAnswerFlow({
    ids,
    mode,
    simplifiedRespondent,
    evidenceDrafts: evidence.evidenceDrafts,
    discardPendingUpload: evidence.discardPendingUpload,
    clearEvidenceDraft: evidence.clearEvidenceDraft,
    loadWorkbench: resource.loadWorkbench,
    setData: resource.setData,
    setFeedback: resource.setFeedback,
    setSavingQuestionId,
    resolveRow,
  });

  const {
    groupedBySection,
    currentSectionIndex,
    setCurrentSectionIndex,
    setStepDirection,
  } = activeNavigation;
  const focusQuestion = useCallback((questionId: string | null) => {
    if (!questionId) return;
    const targetIndex = groupedBySection.findIndex((section) =>
      section.rows.some((row) => row.questionId === questionId),
    );
    if (targetIndex < 0) return;
    setStepDirection(targetIndex < currentSectionIndex ? "back" : "forward");
    setCurrentSectionIndex(targetIndex);
    scrollToWorkbenchTarget(questionId);
  }, [currentSectionIndex, groupedBySection, setCurrentSectionIndex, setStepDirection]);

  const submission = useWorkbenchSubmission({
    data: resource.data,
    mode,
    questionFocusMode: activeNavigation.questionFocusMode,
    submissionReturnTo,
    flushPendingRowsForSubmission: answerFlow.flushPendingRowsForSubmission,
    registerPendingEvidence: answerFlow.registerPendingEvidence,
    loadWorkbench: resource.loadWorkbench,
    loadWorkbenchData: resource.loadWorkbenchData,
    focusQuestion,
    setFeedback: resource.setFeedback,
  });

  const flushTextAutosave = answerFlow.flushTextAutosave;
  const sectionActions = useWorkbenchSectionActions({
    groupedBySection: activeNavigation.groupedBySection,
    currentSectionIndex: activeNavigation.currentSectionIndex,
    setCurrentSectionIndex: activeNavigation.setCurrentSectionIndex,
    setStepDirection: activeNavigation.setStepDirection,
    advancingSection: activeNavigation.advancingSection,
    setAdvancingSection: activeNavigation.setAdvancingSection,
    uploadingQuestionId: evidence.uploadingQuestionId,
    submittingForm: submission.submittingForm,
    onBeforeNavigate: flushTextAutosave,
  });
  const hasUnsavedNaDraft = Object.entries(answerFlow.naJustificationDrafts).some(
    ([questionId, draft]) => {
      const row = rowByQuestionId.get(questionId);
      const persisted = row?.naJustification ?? row?.notes ?? "";
      return draft.trim() !== persisted.trim();
    },
  );
  const hasLocalDrafts =
    Object.keys(evidence.evidenceDrafts).length > 0 ||
    hasUnsavedNaDraft ||
    answerFlow.hasUnconfirmedAutosave;

  useWorkbenchRealtime({
    ids,
    enabled: canAutoLoad,
    savingQuestionId,
    submittingForm: submission.submittingForm,
    hasLocalDrafts,
    setFeedback: resource.setFeedback,
    reload: resource.loadWorkbenchData,
  });

  const { handleRetryFeedback: retrySubmissionFeedback } = submission;
  const handleRetryFeedback = useCallback(
    () => retrySubmissionFeedback(resource.feedback),
    [resource.feedback, retrySubmissionFeedback],
  );

  return {
    data: resource.data,
    feedback: resource.feedback,
    loading: resource.loading,
    savingQuestionId,
    uploadingQuestionId: evidence.uploadingQuestionId,
    evidenceDrafts: evidence.evidenceDrafts,
    submittingForm: submission.submittingForm,
    pendingYesQuestionIds: answerFlow.pendingYesQuestionIds,
    pendingNaQuestionIds: answerFlow.pendingNaQuestionIds,
    naJustificationDrafts: answerFlow.naJustificationDrafts,
    naFieldErrors: answerFlow.naFieldErrors,
    evidenceFieldErrors: answerFlow.evidenceFieldErrors,
    autosaveStatuses: answerFlow.autosaveStatuses,
    retryAutosave: answerFlow.retryAutosave,
    currentSectionIndex: activeNavigation.currentSectionIndex,
    stepDirection: activeNavigation.stepDirection,
    advancingSection: activeNavigation.advancingSection,
    groupedBySection: activeNavigation.groupedBySection,
    questionFocusMode: activeNavigation.questionFocusMode,
    updateEvidenceDraft: evidence.updateEvidenceDraft,
    updateEvidenceAttachment: evidence.updateEvidenceAttachment,
    handleEvidenceKindChange: evidence.handleEvidenceKindChange,
    loadWorkbench: resource.loadWorkbench,
    handleRemoveEvidence: evidence.handleRemoveEvidence,
    handleEvidenceFile: evidence.handleEvidenceFile,
    handleSelectAnswer: answerFlow.handleSelectAnswer,
    updateNaJustification: answerFlow.updateNaJustification,
    saveNaJustification: answerFlow.saveNaJustification,
    saveYesWithEvidence: answerFlow.saveYesWithEvidence,
    handleSectionContinue: sectionActions.handleSectionContinue,
    handleSectionBack: sectionActions.handleSectionBack,
    handleSectionSelect: sectionActions.handleSectionSelect,
    handleReadOnlySectionNext: sectionActions.handleReadOnlySectionNext,
    handleSubmitForm: submission.handleSubmitForm,
    handleRetryFeedback,
  };
}
