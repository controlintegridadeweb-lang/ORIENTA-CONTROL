"use client";

import type { Dispatch, SetStateAction } from "react";
import { validateNaJustification } from "@/shared/domain/not-applicable";
import type { Row } from "./workbench-helpers";
import type {
  SaveResponseOptions,
  WorkbenchFeedback,
} from "./workbench-types";
import type { WorkbenchAnswerValidationController } from "./use-workbench-answer-validation";
import type { CriterionAnswerAutosaveController } from "./use-criterion-answer-autosave";
import type { CriterionAnswerValue } from "./criterion-answer-autosave";

export function useWorkbenchAnswerSelection({
  discardPendingUpload,
  saveResponse,
  validation,
  autosave,
  setFeedback,
  resolveRow,
}: {
  discardPendingUpload: (row: Row) => Promise<boolean>;
  saveResponse: (
    row: Row,
    answer: CriterionAnswerValue,
    options?: SaveResponseOptions,
    notesOverride?: string,
  ) => Promise<boolean>;
  validation: WorkbenchAnswerValidationController;
  autosave: CriterionAnswerAutosaveController;
  setFeedback: Dispatch<SetStateAction<WorkbenchFeedback | null>>;
  resolveRow: (questionId: string) => Row | undefined;
}) {
  async function handleSelectAnswer(
    row: Row,
    answer: CriterionAnswerValue,
  ) {
    if (row.respondentEditable === false) {
      setFeedback({
        tone: "warning",
        title: "Critério bloqueado",
        description:
          "Este critério está fora do escopo da reabertura parcial e não pode ser alterado.",
      });
      return;
    }

    autosave.clearTextDebounce(row.questionId);

    if (answer === "not_applicable") {
      await selectNotApplicable(row);
      return;
    }
    if (answer === "no") {
      const discarded = await discardPendingUpload(row);
      if (!discarded) return;
      validation.clearQuestionValidation(row.questionId);
      await saveResponse(row, answer, { silent: true });
      return;
    }

    validation.clearPendingNa(row.questionId);
    if (row.requiresEvidence) {
      validation.markPendingYes(row.questionId);
      validation.clearEvidenceError(row.questionId);
      setFeedback(null);
      await saveResponse(row, answer, { silent: true });
      return;
    }
    await saveResponse(row, answer, { silent: true });
  }

  async function selectNotApplicable(row: Row) {
    const discarded = await discardPendingUpload(row);
    if (!discarded) return;
    validation.clearPendingYes(row.questionId);
    validation.markPendingNa(row.questionId);
    const draftText =
      validation.naJustificationDrafts[row.questionId] ??
      row.naJustification ??
      row.notes ??
      "";
    validation.ensureNaDraft(row.questionId, draftText);
    const checked = validateNaJustification(draftText);
    if (!checked.ok) {
      validation.markPendingNa(row.questionId, checked.message);
      autosave.clearStatus(row.questionId);
      return;
    }
    validation.clearQuestionValidation(row.questionId);
    await saveResponse(row, "not_applicable", { silent: true }, checked.justification);
  }

  async function saveYesWithEvidence(row: Row): Promise<boolean> {
    autosave.clearTextDebounce(row.questionId);
    validation.clearPendingNa(row.questionId);
    validation.markPendingYes(row.questionId);
    return saveResponse(row, "yes", { requireEvidence: true });
  }

  async function saveNaJustification(row: Row): Promise<boolean> {
    autosave.clearTextDebounce(row.questionId);
    const draftText =
      validation.naJustificationDraftsRef.current[row.questionId] ??
      row.naJustification ??
      row.notes ??
      "";
    const checked = validateNaJustification(draftText);
    if (!checked.ok) {
      validation.markPendingNa(row.questionId, checked.message);
      autosave.clearStatus(row.questionId);
      return false;
    }
    const discarded = await discardPendingUpload(row);
    if (!discarded) return false;
    validation.clearQuestionValidation(row.questionId);
    return saveResponse(
      row,
      "not_applicable",
      { silent: true },
      checked.justification,
    );
  }

  function updateNaJustification(questionId: string, value: string) {
    validation.updateNaJustification(questionId, value);
    const row = resolveRow(questionId);
    if (!row || row.respondentEditable === false) return;

    const checked = validateNaJustification(value);
    if (!checked.ok) {
      validation.markPendingNa(questionId, checked.message);
      autosave.clearTextDebounce(questionId);
      return;
    }

    validation.markPendingNa(questionId);
    autosave.scheduleTextAutosave(questionId, () => {
      const latest = resolveRow(questionId);
      if (!latest) return;
      void saveNaJustification(latest);
    });
  }

  return {
    handleSelectAnswer,
    saveYesWithEvidence,
    saveNaJustification,
    updateNaJustification,
  };
}
