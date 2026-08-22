"use client";

import { useEffect, useRef, useState } from "react";
import { resolveCriterionAdministrativeActions } from "../administrative-actions";
import type { AbsentProofDecisionAction } from "../contracts";
import type { QueueEvidenceGroup } from "../queue-model";
import { answerLabel } from "../queue-model";
import { draftTargetKey } from "../validation-analysis-draft";
import { VALIDATION_ANALYSIS_CONFIRMED_LABEL } from "../validation-analysis-autosave";
import { ABSENT_ACTION_LABEL } from "./evidence-card-config";
import { CriterionAdministrativeActions } from "./CriterionAdministrativeActions";
import { ValidationAutosaveIndicator } from "./validation-autosave-indicator";
import { useOptionalValidationDraftAutosave } from "./validation-draft-autosave-context";
import { LoadingButton } from "@/shared/ui/components/loading";
import { notify } from "@/infrastructure/notifications/notify";
import { formSurface } from "@/shared/layout/form-surface";

function isAbsentAction(
  value: string | null | undefined,
): value is AbsentProofDecisionAction {
  return (
    value === "validate_without_proof" ||
    value === "request_proof" ||
    value === "consider_insufficient"
  );
}

/**
 * Decisões administrativas do critério quando não há documento.
 * Não inclui “Não se aplica” — esse botão fica na seção do critério no EvidenceCard.
 */
export function AbsentProofDecisionPanel({
  group,
  disabled,
  changingDecision,
  onChangingDecisionChange,
  onAbsentProofDecision,
  canRequestProof,
}: {
  group: QueueEvidenceGroup;
  disabled: boolean;
  changingDecision: boolean;
  onChangingDecisionChange: (value: boolean) => void;
  onAbsentProofDecision?: (
    responseId: string,
    action: AbsentProofDecisionAction,
    observation: string,
  ) => Promise<void>;
  canRequestProof: boolean;
}) {
  const draftAutosave = useOptionalValidationDraftAutosave();
  const hydratedRef = useRef(false);
  const targetKey = draftTargetKey("absent_proof", null, group.responseId);
  const initialDraft = group.analysisDraft;
  const [action, setAction] = useState<AbsentProofDecisionAction | null>(() =>
    isAbsentAction(initialDraft?.action) ? initialDraft.action : null,
  );
  const [observation, setObservation] = useState(
    () => initialDraft?.notes ?? initialDraft?.justification ?? "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedFlash, setConfirmedFlash] = useState(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    draftAutosave?.rememberDraft(
      "absent_proof",
      null,
      group.responseId,
      group.analysisDraft ?? null,
    );
  }, [draftAutosave, group.analysisDraft, group.responseId]);

  const pending = group.status === "not_presented";
  const decided =
    group.status === "validated_without_proof" ||
    group.status === "proof_requested" ||
    group.status === "considered_insufficient";
  const decisionOpen =
    pending || (decided && changingDecision) || action !== null;

  const actions = resolveCriterionAdministrativeActions(
    {
      kind: "absent_proof",
      hasValidatableEvidence: false,
      absentProofDecisionOpen: decisionOpen,
      negativeDecisionOpen: false,
      allowsNotApplicable: false,
      answer: group.answer,
      adminApplicabilityStatus: null,
    },
    {
      canValidateEvidence: false,
      canDecideAbsentProof: Boolean(onAbsentProofDecision) && !disabled,
      canMarkAdminNotApplicable: false,
      canRequestProof,
    },
  );

  function persistDraft(
    nextAction: AbsentProofDecisionAction | null,
    nextObservation: string,
    mode: "selection" | "text",
  ) {
    if (!draftAutosave || disabled || submitting) return;
    const payload = {
      targetKind: "absent_proof" as const,
      evidenceId: null,
      responseId: group.responseId,
      action: nextAction,
      justification:
        nextAction === "consider_insufficient"
          ? nextObservation.trim() || null
          : null,
      notes:
        nextAction === "consider_insufficient"
          ? null
          : nextObservation.trim() || null,
    };
    if (mode === "selection") draftAutosave.saveSelection(payload);
    else draftAutosave.saveTextDebounced(payload);
  }

  function cancel() {
    setAction(null);
    setObservation("");
    setError(null);
    if (decided) onChangingDecisionChange(false);
  }

  async function confirm() {
    if (!onAbsentProofDecision || !action) return;
    const value = observation.trim();
    if (!value) {
      setError(
        action === "consider_insufficient"
          ? "Informe a justificativa da decisão."
          : "Informe a observação da validação.",
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (draftAutosave) {
        await draftAutosave.flushTarget("absent_proof", null, group.responseId);
      }
      await onAbsentProofDecision(group.responseId, action, value);
      notify.success(
        action === "validate_without_proof"
          ? "Resposta validada sem comprovação."
          : action === "consider_insufficient"
            ? "Critério marcado como insuficiente."
            : "Comprovação solicitada ao respondente.",
      );
      draftAutosave?.clearDraftMemory("absent_proof", null, group.responseId);
      setConfirmedFlash(true);
      window.setTimeout(() => setConfirmedFlash(false), 2500);
      cancel();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível registrar a decisão.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (actions.primaryActions.length === 0) {
    return null;
  }

  const confirmation = action ? (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 sm:p-4">
      <div className="space-y-1">
        <h5 className="text-sm font-semibold text-slate-800">
          Confirmar: {ABSENT_ACTION_LABEL[action]}
        </h5>
        <p className="text-xs leading-relaxed text-slate-500">
          {group.questionPrompt}
        </p>
      </div>
      <dl className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
        <div>
          <dt className={formSurface.label}>Resposta registrada</dt>
          <dd>{answerLabel(group.answer)}</dd>
        </div>
        <div>
          <dt className={formSurface.label}>Comprovação</dt>
          <dd>não apresentada</dd>
        </div>
        {group.respondentNote ? (
          <div className="sm:col-span-2">
            <dt className={formSurface.label}>Informação complementar</dt>
            <dd className="whitespace-pre-wrap">{group.respondentNote}</dd>
          </div>
        ) : null}
      </dl>
      <DecisionEffect action={action} />
      <label className={formSurface.fieldGroup}>
        <span className={formSurface.label}>
          {action === "consider_insufficient"
            ? "Justificativa da decisão"
            : action === "validate_without_proof"
              ? "Observação da validação"
              : "Orientação ao respondente"}{" "}
          <span className="text-rose-600">*</span>
        </span>
        <textarea
          value={observation}
          onChange={(event) => {
            setObservation(event.target.value);
            persistDraft(action, event.target.value, "text");
          }}
          rows={3}
          maxLength={2000}
          required
          disabled={disabled || submitting}
          className={formSurface.inputTextarea}
          placeholder={
            action === "consider_insufficient"
              ? "Explique por que a resposta/comprovação é insuficiente…"
              : action === "validate_without_proof"
                ? "Registre o fundamento da validação sem comprovação…"
                : "Oriente o respondente sobre a comprovação necessária…"
          }
        />
      </label>
      <ValidationAutosaveIndicator
        state={draftAutosave?.getStatus(targetKey)}
        onRetry={() => draftAutosave?.retry(targetKey)}
        confirmed={confirmedFlash}
        confirmedLabel={VALIDATION_ANALYSIS_CONFIRMED_LABEL}
      />
      {error ? (
        <p role="alert" className={formSurface.messageError}>
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <LoadingButton
          type="button"
          pending={submitting}
          pendingLabel="Registrando…"
          disabled={disabled || submitting || !observation.trim()}
          onClick={() => void confirm()}
          className={`${formSurface.primaryButtonSm} w-full sm:w-auto`}
        >
          Confirmar: {ABSENT_ACTION_LABEL[action]}
        </LoadingButton>
        <button
          type="button"
          disabled={submitting || disabled}
          onClick={cancel}
          className={`${formSurface.ghostButton} w-full sm:w-auto`}
        >
          Cancelar
        </button>
      </div>
    </div>
  ) : null;

  if (action && confirmation) {
    return (
      <div className="space-y-3" aria-label="Confirmação da decisão administrativa">
        {confirmation}
      </div>
    );
  }

  return (
    <CriterionAdministrativeActions
      actions={actions}
      className="space-y-3"
      disabled={disabled || submitting}
      showValidationIntro={false}
      primary={{
        onSelect: (selected) => {
          if (
            selected === "validate_without_proof" ||
            selected === "consider_insufficient" ||
            selected === "request_proof"
          ) {
            setAction(selected);
            setError(null);
            persistDraft(selected, observation, "selection");
          }
        },
        activeAction: action,
        choiceStyle: "evidence",
      }}
      markNotApplicable={null}
    />
  );
}

function DecisionEffect({ action }: { action: AbsentProofDecisionAction }) {
  if (action === "validate_without_proof") {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-950">
        Efeito no FAMI: 1,0 ponto pela resposta positiva. Os 0,5 adicionais só
        são concedidos com evidência apresentada e aprovada.
      </p>
    );
  }
  if (action === "consider_insufficient") {
    return (
      <p className="rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 text-xs leading-relaxed text-rose-950">
        Efeito: 0 ponto no FAMI e recomendação correspondente. A resposta
        original é preservada. Não use esta ação no lugar de “Não se aplica”.
      </p>
    );
  }
  return (
    <p className="rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-xs leading-relaxed text-sky-950">
      O critério será devolvido ao respondente para apresentação de comprovação,
      preservando a resposta e o histórico.
    </p>
  );
}
