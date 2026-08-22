"use client";

import type { Dispatch, SetStateAction } from "react";
import type { EvidenceDraft } from "@/features/workbench/evidence-draft";
import type { YesEvidenceFieldErrors } from "@/features/workbench/validate-yes-evidence";
import type { Mode, Row, WorkbenchPayload } from "./workbench-helpers";
import type {
  WorkbenchFeedback,
  WorkbenchIds,
} from "./workbench-types";
import { flushWorkbenchPendingRows } from "./workbench-batch-submission";
import { useWorkbenchAnswerValidation } from "./use-workbench-answer-validation";
import { useWorkbenchResponsePersistence } from "./use-workbench-response-persistence";
import { useWorkbenchAnswerSelection } from "./use-workbench-answer-selection";
import { useCriterionAnswerAutosave } from "./use-criterion-answer-autosave";

type Params = {
  ids: WorkbenchIds;
  mode: Mode;
  simplifiedRespondent: boolean;
  evidenceDrafts: Record<string, EvidenceDraft>;
  discardPendingUpload: (row: Row) => Promise<boolean>;
  clearEvidenceDraft: (questionId: string) => void;
  loadWorkbench: () => Promise<boolean>;
  setData: Dispatch<SetStateAction<WorkbenchPayload | null>>;
  setFeedback: Dispatch<SetStateAction<WorkbenchFeedback | null>>;
  setSavingQuestionId: Dispatch<SetStateAction<string | null>>;
  resolveRow: (questionId: string) => Row | undefined;
};

/** Coordena validação, persistência e seleção das respostas do workbench. */
export function useWorkbenchAnswerFlow({
  ids,
  mode,
  simplifiedRespondent,
  evidenceDrafts,
  discardPendingUpload,
  clearEvidenceDraft,
  loadWorkbench,
  setData,
  setFeedback,
  setSavingQuestionId,
  resolveRow,
}: Params) {
  const validation = useWorkbenchAnswerValidation(setFeedback);
  const autosave = useCriterionAnswerAutosave();
  const persistence = useWorkbenchResponsePersistence({
    ids,
    mode,
    simplifiedRespondent,
    evidenceDrafts,
    clearEvidenceDraft,
    loadWorkbench,
    setData,
    setFeedback,
    setSavingQuestionId,
    validation,
    autosave,
  });
  const selection = useWorkbenchAnswerSelection({
    discardPendingUpload,
    saveResponse: persistence.saveResponse,
    validation,
    autosave,
    setFeedback,
    resolveRow,
  });

  async function flushPendingRowsForSubmission(rows: Row[]) {
    autosave.flushTextAutosave();
    return flushWorkbenchPendingRows({
      rows,
      ids,
      evidenceDrafts,
      pendingYesQuestionIds: validation.pendingYesQuestionIds,
      pendingNaQuestionIds: validation.pendingNaQuestionIds,
      naJustificationDrafts: validation.naJustificationDrafts,
      discardPendingUpload,
      clearQuestionValidation: validation.clearQuestionValidation,
      clearEvidenceDraft,
      setNaFieldErrors: validation.setNaFieldErrors,
      setFeedback,
      setSavingQuestionId,
    });
  }

  function registerPendingEvidence(
    fieldErrors: Record<string, YesEvidenceFieldErrors>,
    questionIds: Set<string>,
  ) {
    validation.registerPendingEvidence(fieldErrors, questionIds);
  }

  return {
    pendingYesQuestionIds: validation.pendingYesQuestionIds,
    pendingNaQuestionIds: validation.pendingNaQuestionIds,
    naJustificationDrafts: validation.naJustificationDrafts,
    naFieldErrors: validation.naFieldErrors,
    evidenceFieldErrors: validation.evidenceFieldErrors,
    autosaveStatuses: autosave.autosaveStatuses,
    hasUnconfirmedAutosave: autosave.hasUnconfirmedAutosave,
    flushTextAutosave: autosave.flushTextAutosave,
    updateNaJustification: selection.updateNaJustification,
    saveNaJustification: selection.saveNaJustification,
    saveYesWithEvidence: selection.saveYesWithEvidence,
    handleSelectAnswer: selection.handleSelectAnswer,
    retryAutosave: persistence.retryAutosave,
    flushPendingRowsForSubmission,
    registerPendingEvidence,
  };
}
