"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { EvidenceDraft } from "@/features/workbench/evidence-draft";
import { validateYesEvidenceDraftForRow } from "@/features/workbench/validate-evidence-draft";
import {
  formatYesEvidenceErrors,
  type YesEvidenceFieldErrors,
} from "@/features/workbench/validate-yes-evidence";
import type { WorkbenchFeedback } from "./workbench-types";
import type { Row } from "./workbench-helpers";

export function useWorkbenchAnswerValidation(
  setFeedback: Dispatch<SetStateAction<WorkbenchFeedback | null>>,
) {
  const [pendingYesQuestionIds, setPendingYesQuestionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingNaQuestionIds, setPendingNaQuestionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [naJustificationDrafts, setNaJustificationDrafts] = useState<
    Record<string, string>
  >({});
  const naJustificationDraftsRef = useRef(naJustificationDrafts);
  const [naFieldErrors, setNaFieldErrors] = useState<Record<string, string>>({});
  const [evidenceFieldErrors, setEvidenceFieldErrors] = useState<
    Record<string, YesEvidenceFieldErrors>
  >({});

  useEffect(() => {
    naJustificationDraftsRef.current = naJustificationDrafts;
  }, [naJustificationDrafts]);

  function clearQuestionValidation(questionId: string) {
    setPendingYesQuestionIds((current) => withoutSetItem(current, questionId));
    setPendingNaQuestionIds((current) => withoutSetItem(current, questionId));
    setNaFieldErrors((current) => withoutRecordItem(current, questionId));
    setEvidenceFieldErrors((current) =>
      withoutRecordItem(current, questionId),
    );
  }

  function updateNaJustification(questionId: string, value: string) {
    setNaJustificationDrafts((current) => ({
      ...current,
      [questionId]: value,
    }));
    setNaFieldErrors((current) => withoutRecordItem(current, questionId));
  }

  function validateYesEvidence(row: Row, draft: EvidenceDraft): boolean {
    const errors = validateYesEvidenceDraftForRow(row, draft);
    if (Object.keys(errors).length === 0) {
      setEvidenceFieldErrors((current) =>
        withoutRecordItem(current, row.questionId),
      );
      return true;
    }
    setPendingYesQuestionIds((current) =>
      new Set(current).add(row.questionId),
    );
    setEvidenceFieldErrors((current) => ({
      ...current,
      [row.questionId]: errors,
    }));
    setFeedback({
      tone: "warning",
      title: "Complete os dados da evidência",
      description: formatYesEvidenceErrors(errors),
    });
    return false;
  }

  function markPendingNa(questionId: string, message?: string) {
    setPendingNaQuestionIds((current) => new Set(current).add(questionId));
    if (message) {
      setNaFieldErrors((current) => ({ ...current, [questionId]: message }));
    }
  }

  function clearPendingNa(questionId: string) {
    setPendingNaQuestionIds((current) => withoutSetItem(current, questionId));
  }

  function markPendingYes(questionId: string) {
    setPendingYesQuestionIds((current) => new Set(current).add(questionId));
  }

  function clearPendingYes(questionId: string) {
    setPendingYesQuestionIds((current) => withoutSetItem(current, questionId));
  }

  function clearEvidenceError(questionId: string) {
    setEvidenceFieldErrors((current) =>
      withoutRecordItem(current, questionId),
    );
  }

  function setServerEvidenceErrors(
    questionId: string,
    fields: YesEvidenceFieldErrors,
  ) {
    markPendingYes(questionId);
    setEvidenceFieldErrors((current) => ({
      ...current,
      [questionId]: fields,
    }));
  }

  function storeNaJustification(questionId: string, justification: string) {
    setNaJustificationDrafts((current) => ({
      ...current,
      [questionId]: justification,
    }));
  }

  function ensureNaDraft(questionId: string, value: string) {
    setNaJustificationDrafts((current) =>
      questionId in current ? current : { ...current, [questionId]: value },
    );
  }

  function registerPendingEvidence(
    fieldErrors: Record<string, YesEvidenceFieldErrors>,
    questionIds: Set<string>,
  ) {
    if (Object.keys(fieldErrors).length === 0) return;
    setEvidenceFieldErrors((current) => ({ ...current, ...fieldErrors }));
    setPendingYesQuestionIds((current) => {
      const next = new Set(current);
      for (const questionId of questionIds) next.add(questionId);
      return next;
    });
  }

  return {
    pendingYesQuestionIds,
    pendingNaQuestionIds,
    naJustificationDrafts,
    naJustificationDraftsRef,
    naFieldErrors,
    evidenceFieldErrors,
    setNaFieldErrors,
    updateNaJustification,
    clearQuestionValidation,
    validateYesEvidence,
    markPendingNa,
    clearPendingNa,
    markPendingYes,
    clearPendingYes,
    clearEvidenceError,
    setServerEvidenceErrors,
    storeNaJustification,
    ensureNaDraft,
    registerPendingEvidence,
  };
}

export type WorkbenchAnswerValidationController = ReturnType<
  typeof useWorkbenchAnswerValidation
>;

function withoutSetItem(current: Set<string>, item: string) {
  if (!current.has(item)) return current;
  const next = new Set(current);
  next.delete(item);
  return next;
}

function withoutRecordItem<T>(current: Record<string, T>, item: string) {
  if (!(item in current)) return current;
  const next = { ...current };
  delete next[item];
  return next;
}
