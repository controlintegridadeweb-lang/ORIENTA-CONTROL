"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AUTOSAVE_SAVED_VISIBLE_MS,
  AUTOSAVE_TEXT_DEBOUNCE_MS,
  emptyAutosaveState,
  type CriterionAutosaveState,
} from "./criterion-answer-autosave";

type StatusMap = Record<string, CriterionAutosaveState>;

/**
 * Controla estado visual e debounce textual do autosave por critério.
 * A concorrência de persistência (fila por pergunta) fica na camada de save.
 */
export function useCriterionAnswerAutosave() {
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [pendingTextQuestionIds, setPendingTextQuestionIds] = useState<
    Set<string>
  >(() => new Set());
  const debounceTimersRef = useRef<Map<string, number>>(new Map());
  const savedHideTimersRef = useRef<Map<string, number>>(new Map());
  const pendingTextActionsRef = useRef<Map<string, () => void>>(new Map());

  const setQuestionStatus = useCallback(
    (
      questionId: string,
      next: CriterionAutosaveState | ((current: CriterionAutosaveState) => CriterionAutosaveState),
    ) => {
      setStatuses((current) => {
        const previous = current[questionId] ?? emptyAutosaveState();
        const resolved = typeof next === "function" ? next(previous) : next;
        if (
          previous.status === resolved.status &&
          previous.errorMessage === resolved.errorMessage
        ) {
          return current;
        }
        return { ...current, [questionId]: resolved };
      });
    },
    [],
  );

  const markSaving = useCallback(
    (questionId: string) => {
      const hideTimer = savedHideTimersRef.current.get(questionId);
      if (hideTimer !== undefined) {
        window.clearTimeout(hideTimer);
        savedHideTimersRef.current.delete(questionId);
      }
      setQuestionStatus(questionId, { status: "saving" });
    },
    [setQuestionStatus],
  );

  const markSaved = useCallback(
    (questionId: string) => {
      setQuestionStatus(questionId, { status: "saved" });
      const previous = savedHideTimersRef.current.get(questionId);
      if (previous !== undefined) window.clearTimeout(previous);
      const timer = window.setTimeout(() => {
        setQuestionStatus(questionId, (current) =>
          current.status === "saved" ? emptyAutosaveState() : current,
        );
        savedHideTimersRef.current.delete(questionId);
      }, AUTOSAVE_SAVED_VISIBLE_MS);
      savedHideTimersRef.current.set(questionId, timer);
    },
    [setQuestionStatus],
  );

  const markError = useCallback(
    (questionId: string, errorMessage: string) => {
      setQuestionStatus(questionId, { status: "error", errorMessage });
    },
    [setQuestionStatus],
  );

  const clearStatus = useCallback((questionId: string) => {
    setQuestionStatus(questionId, emptyAutosaveState());
  }, [setQuestionStatus]);

  const clearTextDebounce = useCallback((questionId: string) => {
    const timer = debounceTimersRef.current.get(questionId);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      debounceTimersRef.current.delete(questionId);
    }
    pendingTextActionsRef.current.delete(questionId);
    setPendingTextQuestionIds((current) => {
      if (!current.has(questionId)) return current;
      const next = new Set(current);
      next.delete(questionId);
      return next;
    });
  }, []);

  const scheduleTextAutosave = useCallback(
    (questionId: string, action: () => void) => {
      clearTextDebounce(questionId);
      pendingTextActionsRef.current.set(questionId, action);
      setPendingTextQuestionIds((current) => new Set(current).add(questionId));
      const timer = window.setTimeout(() => {
        debounceTimersRef.current.delete(questionId);
        pendingTextActionsRef.current.delete(questionId);
        setPendingTextQuestionIds((current) => {
          if (!current.has(questionId)) return current;
          const next = new Set(current);
          next.delete(questionId);
          return next;
        });
        action();
      }, AUTOSAVE_TEXT_DEBOUNCE_MS);
      debounceTimersRef.current.set(questionId, timer);
    },
    [clearTextDebounce],
  );

  const flushTextAutosave = useCallback((questionId?: string) => {
    const keys = questionId
      ? [questionId]
      : [...pendingTextActionsRef.current.keys()];
    for (const key of keys) {
      const action = pendingTextActionsRef.current.get(key);
      const timer = debounceTimersRef.current.get(key);
      if (timer !== undefined) {
        window.clearTimeout(timer);
        debounceTimersRef.current.delete(key);
      }
      pendingTextActionsRef.current.delete(key);
      setPendingTextQuestionIds((current) => {
        if (!current.has(key)) return current;
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      action?.();
    }
  }, []);

  const hasPendingTextAutosave = pendingTextQuestionIds.size > 0;
  const hasSavingAutosave = Object.values(statuses).some(
    (item) => item.status === "saving",
  );
  const hasUnconfirmedAutosave = hasPendingTextAutosave || hasSavingAutosave;

  useEffect(() => {
    if (!hasUnconfirmedAutosave) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnconfirmedAutosave]);

  useEffect(
    () => () => {
      for (const timer of debounceTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      for (const timer of savedHideTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      debounceTimersRef.current.clear();
      savedHideTimersRef.current.clear();
      pendingTextActionsRef.current.clear();
    },
    [],
  );

  return {
    autosaveStatuses: statuses,
    setQuestionStatus,
    markSaving,
    markSaved,
    markError,
    clearStatus,
    scheduleTextAutosave,
    clearTextDebounce,
    flushTextAutosave,
    hasPendingTextAutosave,
    hasSavingAutosave,
    hasUnconfirmedAutosave,
    pendingTextQuestionIds,
  };
}

export type CriterionAnswerAutosaveController = ReturnType<
  typeof useCriterionAnswerAutosave
>;
