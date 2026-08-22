"use client";

import { useCallback, useEffect, useRef } from "react";
import { saveValidationAnalysisDraftAction } from "@/features/cycles";
import { logError } from "@/infrastructure/observability/logger";
import {
  draftTargetKey,
  isDraftPayloadUnchanged,
  type ValidationDraftTargetKind,
} from "./validation-analysis-draft";
import {
  VALIDATION_AUTOSAVE_ERROR_MESSAGE,
} from "./validation-analysis-autosave";
import type { ValidationAnalysisAutosaveController } from "./use-validation-analysis-autosave";
import type { QueueAnalysisDraft } from "./queue-types";

type DesiredDraft = {
  targetKind: ValidationDraftTargetKind;
  evidenceId: string | null;
  responseId: string | null;
  action: string | null;
  justification: string | null;
  notes: string | null;
  sequence: number;
};

export function useValidationAnalysisDraftPersistence({
  cycleId,
  autosave,
  disabled = false,
}: {
  cycleId: string;
  autosave: ValidationAnalysisAutosaveController;
  disabled?: boolean;
}) {
  const revisionRef = useRef<Map<string, number | null>>(new Map());
  const persistedRef = useRef<
    Map<
      string,
      { action: string | null; justification: string | null; notes: string | null }
    >
  >(new Map());
  const sequenceRef = useRef<Map<string, number>>(new Map());
  const desiredRef = useRef<Map<string, DesiredDraft>>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());
  const lastRetryRef = useRef<Map<string, DesiredDraft>>(new Map());
  const disabledRef = useRef(disabled);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const rememberDraft = useCallback(
    (
      targetKind: ValidationDraftTargetKind,
      evidenceId: string | null,
      responseId: string | null,
      draft: QueueAnalysisDraft | null | undefined,
    ) => {
      const key = draftTargetKey(targetKind, evidenceId, responseId);
      if (!draft) {
        revisionRef.current.set(key, null);
        persistedRef.current.delete(key);
        return;
      }
      revisionRef.current.set(key, draft.revision);
      persistedRef.current.set(key, {
        action: draft.action,
        justification: draft.justification,
        notes: draft.notes,
      });
    },
    [],
  );

  const clearDraftMemory = useCallback(
    (
      targetKind: ValidationDraftTargetKind,
      evidenceId: string | null,
      responseId: string | null,
    ) => {
      const key = draftTargetKey(targetKind, evidenceId, responseId);
      revisionRef.current.set(key, null);
      persistedRef.current.delete(key);
      desiredRef.current.delete(key);
      lastRetryRef.current.delete(key);
      autosave.clearStatus(key);
      autosave.clearTextDebounce(key);
    },
    [autosave],
  );

  const executeSave = useCallback(
    async (desired: DesiredDraft): Promise<boolean> => {
      const key = draftTargetKey(
        desired.targetKind,
        desired.evidenceId,
        desired.responseId,
      );
      if (disabledRef.current) {
        autosave.clearStatus(key);
        return false;
      }

      const persisted = persistedRef.current.get(key) ?? null;
      if (
        isDraftPayloadUnchanged(persisted, {
          action: desired.action,
          justification: desired.justification,
          notes: desired.notes,
        })
      ) {
        autosave.clearStatus(key);
        return true;
      }

      const expectedRevision = revisionRef.current.get(key) ?? null;
      autosave.markSaving(key);
      try {
        const result = await saveValidationAnalysisDraftAction(cycleId, {
          targetKind: desired.targetKind,
          evidenceId: desired.evidenceId,
          responseId: desired.responseId,
          action: desired.action,
          justification: desired.justification,
          notes: desired.notes,
          expectedRevision,
        });

        const latest = desiredRef.current.get(key);
        if (!latest || latest.sequence !== desired.sequence) {
          return false;
        }

        revisionRef.current.set(key, result.revision);
        persistedRef.current.set(key, {
          action: result.action,
          justification: result.justification,
          notes: result.notes,
        });
        lastRetryRef.current.delete(key);
        autosave.markSaved(key);
        return true;
      } catch (error) {
        const latest = desiredRef.current.get(key);
        if (latest && latest.sequence !== desired.sequence) {
          return false;
        }
        lastRetryRef.current.set(key, desired);
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : VALIDATION_AUTOSAVE_ERROR_MESSAGE;
        autosave.markError(key, message);
        logError("validation.analysis_draft_autosave_failed", {
          cycleId,
          targetKind: desired.targetKind,
          evidenceId: desired.evidenceId,
          responseId: desired.responseId,
          message,
        });
        return false;
      }
    },
    [autosave, cycleId],
  );

  const pump = useCallback(
    async (key: string) => {
      if (inFlightRef.current.has(key)) return;
      inFlightRef.current.add(key);
      try {
        while (desiredRef.current.has(key)) {
          const desired = desiredRef.current.get(key);
          if (!desired) break;
          desiredRef.current.delete(key);
          await executeSave(desired);
        }
      } finally {
        inFlightRef.current.delete(key);
      }
    },
    [executeSave],
  );

  const enqueueSave = useCallback(
    (input: Omit<DesiredDraft, "sequence">) => {
      const key = draftTargetKey(
        input.targetKind,
        input.evidenceId,
        input.responseId,
      );
      const sequence = (sequenceRef.current.get(key) ?? 0) + 1;
      sequenceRef.current.set(key, sequence);
      desiredRef.current.set(key, { ...input, sequence });
      void pump(key);
    },
    [pump],
  );

  const saveSelection = useCallback(
    (input: Omit<DesiredDraft, "sequence">) => {
      const key = draftTargetKey(
        input.targetKind,
        input.evidenceId,
        input.responseId,
      );
      autosave.clearTextDebounce(key);
      enqueueSave(input);
    },
    [autosave, enqueueSave],
  );

  const saveTextDebounced = useCallback(
    (input: Omit<DesiredDraft, "sequence">) => {
      const key = draftTargetKey(
        input.targetKind,
        input.evidenceId,
        input.responseId,
      );
      autosave.scheduleTextAutosave(key, () => {
        enqueueSave(input);
      });
    },
    [autosave, enqueueSave],
  );

  const retry = useCallback(
    (targetKey: string) => {
      const desired = lastRetryRef.current.get(targetKey);
      if (!desired) return;
      enqueueSave(desired);
    },
    [enqueueSave],
  );

  const flushTarget = useCallback(
    async (
      targetKind: ValidationDraftTargetKind,
      evidenceId: string | null,
      responseId: string | null,
    ) => {
      const key = draftTargetKey(targetKind, evidenceId, responseId);
      await autosave.flushTextAutosave(key);
      await pump(key);
      while (inFlightRef.current.has(key) || desiredRef.current.has(key)) {
        await new Promise((resolve) => window.setTimeout(resolve, 20));
        await pump(key);
      }
    },
    [autosave, pump],
  );

  const flushAll = useCallback(async () => {
    await autosave.flushTextAutosave();
    const keys = new Set([
      ...desiredRef.current.keys(),
      ...inFlightRef.current.values(),
    ]);
    await Promise.all([...keys].map((key) => pump(key)));
    while (desiredRef.current.size > 0 || inFlightRef.current.size > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, 20));
      await Promise.all(
        [...new Set([...desiredRef.current.keys(), ...inFlightRef.current])].map(
          (key) => pump(key),
        ),
      );
    }
  }, [autosave, pump]);

  return {
    rememberDraft,
    clearDraftMemory,
    saveSelection,
    saveTextDebounced,
    retry,
    flushTarget,
    flushAll,
    getStatus: (targetKey: string) => autosave.autosaveStatuses[targetKey],
    hasUnconfirmedAutosave: autosave.hasUnconfirmedAutosave,
  };
}

export type ValidationAnalysisDraftPersistence = ReturnType<
  typeof useValidationAnalysisDraftPersistence
>;
