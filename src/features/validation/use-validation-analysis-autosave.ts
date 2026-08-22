"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  VALIDATION_AUTOSAVE_SAVED_VISIBLE_MS,
  VALIDATION_AUTOSAVE_TEXT_DEBOUNCE_MS,
  emptyValidationAutosaveState,
  type ValidationAutosaveState,
} from "./validation-analysis-autosave";

type StatusMap = Record<string, ValidationAutosaveState>;

/**
 * Estado visual e debounce textual do autosave de rascunho por alvo de validação.
 */
export function useValidationAnalysisAutosave() {
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [pendingTextKeys, setPendingTextKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const debounceTimersRef = useRef<Map<string, number>>(new Map());
  const savedHideTimersRef = useRef<Map<string, number>>(new Map());
  const pendingTextActionsRef = useRef<Map<string, () => void>>(new Map());

  const setTargetStatus = useCallback(
    (
      targetKey: string,
      next:
        | ValidationAutosaveState
        | ((current: ValidationAutosaveState) => ValidationAutosaveState),
    ) => {
      setStatuses((current) => {
        const previous = current[targetKey] ?? emptyValidationAutosaveState();
        const resolved = typeof next === "function" ? next(previous) : next;
        if (
          previous.status === resolved.status &&
          previous.errorMessage === resolved.errorMessage
        ) {
          return current;
        }
        return { ...current, [targetKey]: resolved };
      });
    },
    [],
  );

  const markSaving = useCallback(
    (targetKey: string) => {
      const hideTimer = savedHideTimersRef.current.get(targetKey);
      if (hideTimer !== undefined) {
        window.clearTimeout(hideTimer);
        savedHideTimersRef.current.delete(targetKey);
      }
      setTargetStatus(targetKey, { status: "saving" });
    },
    [setTargetStatus],
  );

  const markSaved = useCallback(
    (targetKey: string) => {
      setTargetStatus(targetKey, { status: "saved" });
      const previous = savedHideTimersRef.current.get(targetKey);
      if (previous !== undefined) window.clearTimeout(previous);
      const timer = window.setTimeout(() => {
        setTargetStatus(targetKey, (current) =>
          current.status === "saved" ? emptyValidationAutosaveState() : current,
        );
        savedHideTimersRef.current.delete(targetKey);
      }, VALIDATION_AUTOSAVE_SAVED_VISIBLE_MS);
      savedHideTimersRef.current.set(targetKey, timer);
    },
    [setTargetStatus],
  );

  const markError = useCallback(
    (targetKey: string, errorMessage: string) => {
      setTargetStatus(targetKey, { status: "error", errorMessage });
    },
    [setTargetStatus],
  );

  const clearStatus = useCallback(
    (targetKey: string) => {
      setTargetStatus(targetKey, emptyValidationAutosaveState());
    },
    [setTargetStatus],
  );

  const clearTextDebounce = useCallback((targetKey: string) => {
    const timer = debounceTimersRef.current.get(targetKey);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      debounceTimersRef.current.delete(targetKey);
    }
    pendingTextActionsRef.current.delete(targetKey);
    setPendingTextKeys((current) => {
      if (!current.has(targetKey)) return current;
      const next = new Set(current);
      next.delete(targetKey);
      return next;
    });
  }, []);

  const scheduleTextAutosave = useCallback(
    (targetKey: string, action: () => void) => {
      clearTextDebounce(targetKey);
      pendingTextActionsRef.current.set(targetKey, action);
      setPendingTextKeys((current) => new Set(current).add(targetKey));
      const timer = window.setTimeout(() => {
        debounceTimersRef.current.delete(targetKey);
        pendingTextActionsRef.current.delete(targetKey);
        setPendingTextKeys((current) => {
          if (!current.has(targetKey)) return current;
          const next = new Set(current);
          next.delete(targetKey);
          return next;
        });
        action();
      }, VALIDATION_AUTOSAVE_TEXT_DEBOUNCE_MS);
      debounceTimersRef.current.set(targetKey, timer);
    },
    [clearTextDebounce],
  );

  const flushTextAutosave = useCallback(async (targetKey?: string) => {
    const keys = targetKey
      ? [targetKey]
      : [...pendingTextActionsRef.current.keys()];
    const actions: Array<() => void> = [];
    for (const key of keys) {
      const action = pendingTextActionsRef.current.get(key);
      const timer = debounceTimersRef.current.get(key);
      if (timer !== undefined) {
        window.clearTimeout(timer);
        debounceTimersRef.current.delete(key);
      }
      pendingTextActionsRef.current.delete(key);
      setPendingTextKeys((current) => {
        if (!current.has(key)) return current;
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      if (action) actions.push(action);
    }
    for (const action of actions) action();
  }, []);

  const hasPendingTextAutosave = pendingTextKeys.size > 0;
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
  };
}

export type ValidationAnalysisAutosaveController = ReturnType<
  typeof useValidationAnalysisAutosave
>;
