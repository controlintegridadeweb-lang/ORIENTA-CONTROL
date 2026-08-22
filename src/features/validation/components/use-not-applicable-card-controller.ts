"use client";

import { useEffect, useRef, useState } from "react";
import { notify } from "@/infrastructure/notifications/notify";
import type { QueueNotApplicable } from "@/features/validation/queue-model";
import { canSubmitNaVerdict } from "@/features/validation/queue-model";
import { draftTargetKey } from "../validation-analysis-draft";
import { useOptionalValidationDraftAutosave } from "./validation-draft-autosave-context";

export type NotApplicableAction = "approve" | "reject";

const ACTION_SUCCESS: Record<NotApplicableAction, string> = {
  approve: "“Não se aplica” aceito.",
  reject: "“Não se aplica” rejeitado; a resposta passou a ser “Não”.",
};

function isNaAction(
  value: string | null | undefined,
): value is NotApplicableAction {
  return value === "approve" || value === "reject";
}

export function useNotApplicableCardController({
  item,
  onVerdict,
  onRevertAdminNotApplicable,
  disabled,
}: {
  item: QueueNotApplicable;
  onVerdict: (
    responseId: string,
    action: NotApplicableAction,
    rejectionReason: string,
  ) => Promise<void>;
  onRevertAdminNotApplicable?: (
    responseId: string,
    justification: string,
  ) => Promise<void>;
  disabled: boolean;
}) {
  const draftAutosave = useOptionalValidationDraftAutosave();
  const hydratedRef = useRef(false);
  const targetKey = draftTargetKey("not_applicable", null, item.id);
  const initialDraft = item.analysisDraft;

  const [action, setAction] = useState<NotApplicableAction | null>(() =>
    isNaAction(initialDraft?.action) ? initialDraft.action : null,
  );
  const [rejectionReason, setRejectionReason] = useState(
    () => initialDraft?.justification ?? "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changingDecision, setChangingDecision] = useState(
    () => Boolean(initialDraft?.action) && item.status !== "pending",
  );
  const [reverting, setReverting] = useState(false);
  const [revertJustification, setRevertJustification] = useState("");
  const [confirmedFlash, setConfirmedFlash] = useState(false);

  const isAdminDecision = item.source === "admin";
  const decided = item.status !== "pending";
  const showActions =
    !isAdminDecision && (!decided || changingDecision || action !== null);
  const canSubmit =
    action !== null &&
    canSubmitNaVerdict(action, rejectionReason) &&
    !submitting &&
    !disabled;

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    draftAutosave?.rememberDraft(
      "not_applicable",
      null,
      item.id,
      item.analysisDraft ?? null,
    );
  }, [draftAutosave, item.analysisDraft, item.id]);

  function persistDraft(
    nextAction: NotApplicableAction | null,
    nextReason: string,
    mode: "selection" | "text",
  ) {
    if (!draftAutosave || disabled || submitting || isAdminDecision) return;
    const payload = {
      targetKind: "not_applicable" as const,
      evidenceId: null,
      responseId: item.id,
      action: nextAction,
      justification:
        nextAction === "reject" ? nextReason.trim() || null : null,
      notes: null,
    };
    if (mode === "selection") draftAutosave.saveSelection(payload);
    else draftAutosave.saveTextDebounced(payload);
  }

  async function confirmVerdict() {
    if (!action || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      if (draftAutosave) {
        await draftAutosave.flushTarget("not_applicable", null, item.id);
      }
      await onVerdict(item.id, action, rejectionReason.trim());
      notify.success(
        action === "reject" && item.status === "rejected"
          ? "Motivo da rejeição atualizado."
          : ACTION_SUCCESS[action],
      );
      draftAutosave?.clearDraftMemory("not_applicable", null, item.id);
      setAction(null);
      setRejectionReason("");
      setChangingDecision(false);
      setConfirmedFlash(true);
      window.setTimeout(() => setConfirmedFlash(false), 2500);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível registrar o veredito.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmRevert() {
    if (!onRevertAdminNotApplicable) return;
    const justification = revertJustification.trim();
    if (!justification) {
      setError("Informe a justificativa da revisão.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onRevertAdminNotApplicable(item.id, justification);
      notify.success(
        "Decisão reaberta. O critério retornou para a fila de validação.",
      );
      setReverting(false);
      setRevertJustification("");
      setChangingDecision(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível revisar a decisão.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function startRevert() {
    setReverting(true);
    setChangingDecision(true);
    setError(null);
  }

  function cancelRevert() {
    setReverting(false);
    setChangingDecision(false);
    setRevertJustification("");
    setError(null);
  }

  function startDecisionChange() {
    setChangingDecision(true);
    setError(null);
  }

  function selectAction(nextAction: NotApplicableAction) {
    setAction(nextAction);
    setError(null);
    const nextReason =
      nextAction === "reject" ? item.rejectionReason ?? "" : "";
    setRejectionReason(nextReason);
    persistDraft(nextAction, nextReason, "selection");
  }

  function updateRejectionReason(value: string) {
    setRejectionReason(value);
    if (action !== "reject") return;
    persistDraft(action, value, "text");
  }

  function cancelAction() {
    setAction(null);
    setRejectionReason("");
    setError(null);
    if (decided) setChangingDecision(false);
  }

  return {
    action,
    rejectionReason,
    setRejectionReason: updateRejectionReason,
    submitting,
    error,
    changingDecision,
    reverting,
    revertJustification,
    setRevertJustification,
    isAdminDecision,
    decided,
    showActions,
    canSubmit,
    confirmVerdict,
    confirmRevert,
    startRevert,
    cancelRevert,
    startDecisionChange,
    selectAction,
    cancelAction,
    autosaveTargetKey: targetKey,
    autosaveState: draftAutosave?.getStatus(targetKey),
    retryAutosave: () => draftAutosave?.retry(targetKey),
    confirmedFlash,
  };
}

export type NotApplicableCardController = ReturnType<
  typeof useNotApplicableCardController
>;
