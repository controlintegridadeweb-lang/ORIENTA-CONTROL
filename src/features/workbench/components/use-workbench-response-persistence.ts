"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { EvidenceDraft } from "@/features/workbench/evidence-draft";
import { resolveEvidenceDraft } from "@/features/workbench/section-progress";
import { submitWorkbenchResponse } from "@/infrastructure/client/workbench-api";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import { parseJson } from "@/infrastructure/api/fetch-client";
import { workbenchMutationResponseSchema } from "@/features/workbench/http-contracts";
import { validateNaJustification } from "@/shared/domain/not-applicable";
import { logError } from "@/infrastructure/observability/logger";
import { invalidateRespondentOverviewCache } from "@/features/improvement-management";
import { buildWorkbenchEvidencePayloads } from "./workbench-response-payload";
import { refreshWorkbenchAfterSave } from "./refresh-workbench-after-save";
import type { Mode, Row, WorkbenchPayload } from "./workbench-helpers";
import type {
  SaveResponseOptions,
  WorkbenchFeedback,
  WorkbenchIds,
} from "./workbench-types";
import type { WorkbenchAnswerValidationController } from "./use-workbench-answer-validation";
import type { CriterionAnswerAutosaveController } from "./use-criterion-answer-autosave";
import {
  AUTOSAVE_ERROR_MESSAGE,
  answerChangeRequiresFullReload,
  isPersistedAnswerUnchanged,
  patchWorkbenchRowAfterAnswerSave,
  type CriterionAnswerValue,
} from "./criterion-answer-autosave";

type DesiredSave = {
  row: Row;
  answer: CriterionAnswerValue;
  options?: SaveResponseOptions;
  notesOverride?: string;
  /** Quando true, exige evidência válida antes de persistir (botão explícito). */
  requireEvidence: boolean;
  sequence: number;
};

export function useWorkbenchResponsePersistence({
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
}: {
  ids: WorkbenchIds;
  mode: Mode;
  simplifiedRespondent: boolean;
  evidenceDrafts: Record<string, EvidenceDraft>;
  clearEvidenceDraft: (questionId: string) => void;
  loadWorkbench: () => Promise<boolean>;
  setData: Dispatch<SetStateAction<WorkbenchPayload | null>>;
  setFeedback: Dispatch<SetStateAction<WorkbenchFeedback | null>>;
  setSavingQuestionId: Dispatch<SetStateAction<string | null>>;
  validation: WorkbenchAnswerValidationController;
  autosave: CriterionAnswerAutosaveController;
}) {
  const desiredRef = useRef<Map<string, DesiredSave>>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());
  const sequenceRef = useRef<Map<string, number>>(new Map());
  const revisionRef = useRef<Map<string, number | null>>(new Map());
  const lastRetryRef = useRef<Map<string, DesiredSave>>(new Map());
  const evidenceDraftsRef = useRef(evidenceDrafts);

  useEffect(() => {
    evidenceDraftsRef.current = evidenceDrafts;
  }, [evidenceDrafts]);

  const syncSavingQuestionId = useCallback(() => {
    const first = inFlightRef.current.values().next().value;
    setSavingQuestionId(typeof first === "string" ? first : null);
  }, [setSavingQuestionId]);

  const rememberRevision = useCallback((questionId: string, revision: number | null | undefined) => {
    revisionRef.current.set(questionId, revision ?? null);
  }, []);

  const executeSave = useCallback(
    async (desired: DesiredSave): Promise<boolean> => {
      const { row, answer, options, notesOverride, requireEvidence, sequence } = desired;
      const drafts = evidenceDraftsRef.current;
      const draft = resolveEvidenceDraft(row, drafts);

      if (
        requireEvidence &&
        answer === "yes" &&
        row.requiresEvidence &&
        !validation.validateYesEvidence(row, draft)
      ) {
        autosave.markError(row.questionId, "Complete os dados da evidência.");
        return false;
      }

      const normalizedNotes = resolveValidatedNotes({
        row,
        answer,
        notesOverride,
        naJustificationDrafts: validation.naJustificationDraftsRef.current,
        onInvalidNa: (message) => {
          validation.markPendingNa(row.questionId, message);
          autosave.clearStatus(row.questionId);
          if (!options?.silent) {
            setFeedback({
              tone: "warning",
              title: "Justificativa obrigatória",
              description: message,
            });
          }
        },
      });
      if (normalizedNotes === null) return false;

      const expectedRevision =
        revisionRef.current.get(row.questionId) ?? row.responseRevision ?? null;

      if (
        isPersistedAnswerUnchanged(row, answer, normalizedNotes) &&
        !requireEvidence &&
        !drafts[row.questionId]
      ) {
        autosave.clearStatus(row.questionId);
        return true;
      }

      const builtEvidences = buildWorkbenchEvidencePayloads(
        { ...row, answer },
        draft,
        { hasLocalChanges: Boolean(drafts[row.questionId]) },
      );
      if (builtEvidences === null && requireEvidence) {
        validation.validateYesEvidence(row, draft);
        if (answer === "yes" && row.requiresEvidence) {
          validation.markPendingYes(row.questionId);
        }
        autosave.markError(row.questionId, "Complete os dados da evidência.");
        return false;
      }
      // Autosave da resposta ignora rascunho incompleto de evidência; o anexo segue local.
      const evidences = builtEvidences === null ? undefined : builtEvidences;

      const hasEvidencePayload = Boolean(evidences?.length);
      if (
        !hasEvidencePayload &&
        isPersistedAnswerUnchanged(row, answer, normalizedNotes)
      ) {
        autosave.clearStatus(row.questionId);
        return true;
      }

      autosave.markSaving(row.questionId);
      if (!options?.silent) setFeedback(null);

      try {
        const response = await submitWorkbenchResponse(ids, {
          questionId: row.questionId,
          expectedRevision,
          answer,
          notes: normalizedNotes,
          ...(evidences?.length === 1
            ? { evidence: evidences[0] }
            : evidences?.length
              ? { evidences }
              : {}),
        });
        const payload = await parseJson(response, workbenchMutationResponseSchema);
        const isLatest = sequenceRef.current.get(row.questionId) === sequence;

        if (!response.ok) {
          if (!isLatest) return true;
          if (answer === "yes" && row.requiresEvidence && payload.fields) {
            validation.setServerEvidenceErrors(row.questionId, payload.fields);
          }
          if (answer === "not_applicable") {
            validation.markPendingNa(row.questionId);
          }
          const message =
            typeof payload.error === "string"
              ? payload.error
              : AUTOSAVE_ERROR_MESSAGE;
          autosave.markError(row.questionId, message);
          lastRetryRef.current.set(row.questionId, desired);
          logError("workbench.autosave.failed", new Error(message), {
            questionId: row.questionId,
            cycleId: ids.cycleId,
            answer,
          });
          if (!options?.silent && !simplifiedRespondent) {
            setFeedback({
              tone: "error",
              title: AUTOSAVE_ERROR_MESSAGE,
              description: message,
            });
          }
          return false;
        }

        const saved = payload.response;
        if (!saved) {
          if (!isLatest) return true;
          autosave.markError(row.questionId, AUTOSAVE_ERROR_MESSAGE);
          lastRetryRef.current.set(row.questionId, desired);
          return false;
        }

        // Sempre reconcilia a revisão, mesmo se a intenção do usuário já mudou.
        rememberRevision(row.questionId, saved.revision);

        if (!isLatest) {
          return true;
        }

        validation.clearQuestionValidation(row.questionId);
        if (hasEvidencePayload) {
          clearEvidenceDraft(row.questionId);
        }
        if (answer === "not_applicable" && normalizedNotes) {
          validation.storeNaJustification(row.questionId, normalizedNotes);
        }
        if (answer === "yes" && row.requiresEvidence && !hasEvidencePayload) {
          validation.markPendingYes(row.questionId);
        }
        if (row.hasAdjustmentRequest && hasEvidencePayload) {
          notify.success("Correção salva com sucesso.");
        }

        const needsReload = answerChangeRequiresFullReload(
          row,
          answer,
          hasEvidencePayload,
        );
        if (needsReload) {
          const reloaded = await refreshWorkbenchAfterSave({
            deferReload: Boolean(options?.deferReload),
            loadWorkbench,
            mode,
            setFeedback,
          });
          if (!reloaded && !options?.deferReload) {
            autosave.markSaved(row.questionId);
            return true;
          }
        } else {
          setData((current) =>
            current
              ? patchWorkbenchRowAfterAnswerSave(current, row.questionId, {
                  id: saved.id,
                  answer: saved.answer,
                  notes: saved.notes,
                  revision: saved.revision,
                })
              : current,
          );
          if (mode === "respondent") {
            invalidateRespondentOverviewCache();
          }
        }

        lastRetryRef.current.delete(row.questionId);
        autosave.markSaved(row.questionId);
        if (simplifiedRespondent || !options?.silent) {
          if (!needsReload) setFeedback(null);
        }
        return true;
      } catch (caught: unknown) {
        if (sequenceRef.current.get(row.questionId) !== sequence) {
          return true;
        }
        const message = describeError(caught, AUTOSAVE_ERROR_MESSAGE);
        autosave.markError(row.questionId, message);
        lastRetryRef.current.set(row.questionId, desired);
        logError("workbench.autosave.failed", caught, {
          questionId: row.questionId,
          cycleId: ids.cycleId,
          answer,
        });
        if (!options?.silent && !simplifiedRespondent) {
          setFeedback({
            tone: "error",
            title: AUTOSAVE_ERROR_MESSAGE,
            description: message,
          });
        }
        return false;
      }
    },
    [
      autosave,
      clearEvidenceDraft,
      ids,
      loadWorkbench,
      mode,
      rememberRevision,
      setData,
      setFeedback,
      simplifiedRespondent,
      validation,
    ],
  );

  const drainQueue = useCallback(
    async (questionId: string): Promise<boolean> => {
      if (inFlightRef.current.has(questionId)) return true;
      let lastOk = true;
      while (desiredRef.current.has(questionId)) {
        const desired = desiredRef.current.get(questionId);
        if (!desired) break;
        desiredRef.current.delete(questionId);
        inFlightRef.current.add(questionId);
        syncSavingQuestionId();
        try {
          lastOk = await executeSave(desired);
        } finally {
          inFlightRef.current.delete(questionId);
          syncSavingQuestionId();
        }
      }
      return lastOk;
    },
    [executeSave, syncSavingQuestionId],
  );

  const saveResponse = useCallback(
    async (
      row: Row,
      answer: CriterionAnswerValue,
      options?: SaveResponseOptions,
      notesOverride?: string,
    ): Promise<boolean> => {
      rememberRevision(row.questionId, row.responseRevision);
      const sequence = (sequenceRef.current.get(row.questionId) ?? 0) + 1;
      sequenceRef.current.set(row.questionId, sequence);
      const desired: DesiredSave = {
        row,
        answer,
        options,
        notesOverride,
        requireEvidence: Boolean(options?.requireEvidence),
        sequence,
      };
      desiredRef.current.set(row.questionId, desired);
      lastRetryRef.current.set(row.questionId, desired);
      return drainQueue(row.questionId);
    },
    [drainQueue, rememberRevision],
  );

  const retryAutosave = useCallback(
    async (questionId: string): Promise<boolean> => {
      const desired = lastRetryRef.current.get(questionId);
      if (!desired) return false;
      const sequence = (sequenceRef.current.get(questionId) ?? 0) + 1;
      sequenceRef.current.set(questionId, sequence);
      desiredRef.current.set(questionId, { ...desired, sequence });
      return drainQueue(questionId);
    },
    [drainQueue],
  );

  return { saveResponse, retryAutosave };
}

function resolveValidatedNotes({
  row,
  answer,
  notesOverride,
  naJustificationDrafts,
  onInvalidNa,
}: {
  row: Row;
  answer: CriterionAnswerValue;
  notesOverride?: string;
  naJustificationDrafts: Record<string, string>;
  onInvalidNa: (message: string) => void;
}): string | null {
  if (answer !== "not_applicable") {
    return notesOverride ?? row.notes ?? "";
  }
  const candidate =
    notesOverride ??
    naJustificationDrafts[row.questionId] ??
    row.naJustification ??
    row.notes ??
    "";
  const checked = validateNaJustification(candidate);
  if (!checked.ok) {
    onInvalidNa(checked.message);
    return null;
  }
  return checked.justification;
}
