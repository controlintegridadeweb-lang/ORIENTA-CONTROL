"use client";

import { useEffect, useRef, useState } from "react";
import { resolveCriterionAdministrativeActions } from "../administrative-actions";
import type { EvidenceDecisionAction } from "../contracts";
import type { QueueEvidence } from "../queue-model";
import {
  canSubmitVerdict,
  EVIDENCE_JUSTIFICATION_PRESETS,
  justificationRequired,
} from "../queue-model";
import { draftTargetKey } from "../validation-analysis-draft";
import { VALIDATION_ANALYSIS_CONFIRMED_LABEL } from "../validation-analysis-autosave";
import {
  EVIDENCE_ACTION_LABEL,
  EVIDENCE_ACTION_SUCCESS,
  evidenceDecisionButtonClass,
  formatValidationDateTime,
} from "./evidence-card-config";
import { criterionSection } from "./criterion-card-sections";
import { ValidationAutosaveIndicator } from "./validation-autosave-indicator";
import { EvidenceDocumentSummary } from "./EvidenceDocumentSummary";
import { useOptionalValidationDraftAutosave } from "./validation-draft-autosave-context";
import { LoadingButton } from "@/shared/ui/components/loading";
import { notify } from "@/infrastructure/notifications/notify";
import { formSurface } from "@/shared/layout/form-surface";

function isEvidenceAction(
  value: string | null | undefined,
): value is EvidenceDecisionAction {
  return (
    value === "approve" ||
    value === "invalidate" ||
    value === "request_adjustment"
  );
}

export function EvidenceDocumentDecisionRow({
  document,
  onVerdict,
  disabled,
  highlighted = false,
}: {
  document: QueueEvidence;
  onVerdict: (
    evidenceId: string,
    action: EvidenceDecisionAction,
    justification: string,
  ) => Promise<void>;
  disabled: boolean;
  highlighted?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);
  const draftAutosave = useOptionalValidationDraftAutosave();
  const targetKey = draftTargetKey("evidence", document.id, null);
  const initialDraft = document.analysisDraft;

  const [action, setAction] = useState<EvidenceDecisionAction | null>(() =>
    isEvidenceAction(initialDraft?.action) ? initialDraft.action : null,
  );
  const [justification, setJustification] = useState(
    () => initialDraft?.justification ?? "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changingDecision, setChangingDecision] = useState(
    () => Boolean(initialDraft?.action) && document.status !== "pending",
  );
  const [confirmedFlash, setConfirmedFlash] = useState(false);

  const decided = document.status !== "pending";
  const showActions = !decided || changingDecision || action !== null;
  const needsJustification = action ? justificationRequired(action) : false;
  const canSubmit =
    action !== null &&
    canSubmitVerdict(action, justification) &&
    !submitting &&
    !disabled;
  const decisionMeta = [
    document.validatedByName ? `Responsável: ${document.validatedByName}` : null,
    formatValidationDateTime(document.validatedAt),
  ]
    .filter(Boolean)
    .join(" · ");

  const evidenceActions = resolveCriterionAdministrativeActions(
    {
      kind: "evidence_document",
      hasValidatableEvidence: showActions,
      absentProofDecisionOpen: false,
      negativeDecisionOpen: false,
      allowsNotApplicable: false,
      answer: document.answer,
      adminApplicabilityStatus: null,
    },
    {
      canValidateEvidence: !disabled,
      canDecideAbsentProof: false,
      canMarkAdminNotApplicable: false,
      canRequestProof: false,
    },
  );

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    draftAutosave?.rememberDraft(
      "evidence",
      document.id,
      null,
      document.analysisDraft ?? null,
    );
  }, [document.analysisDraft, document.id, draftAutosave]);

  useEffect(() => {
    if (!highlighted) return;
    const element = containerRef.current;
    if (!element) return;
    const handle = window.requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(handle);
  }, [highlighted]);

  function persistDraft(
    nextAction: EvidenceDecisionAction | null,
    nextJustification: string,
    mode: "selection" | "text",
  ) {
    if (!draftAutosave || disabled || submitting) return;
    if (!showActions && decided && !changingDecision) return;
    const payload = {
      targetKind: "evidence" as const,
      evidenceId: document.id,
      responseId: null,
      action: nextAction,
      justification: nextJustification.trim() || null,
      notes: null,
    };
    if (mode === "selection") draftAutosave.saveSelection(payload);
    else draftAutosave.saveTextDebounced(payload);
  }

  function selectAction(selected: EvidenceDecisionAction) {
    setAction(selected);
    setError(null);
    const nextJustification = justificationRequired(selected)
      ? justification
      : "";
    if (!justificationRequired(selected)) setJustification("");
    persistDraft(selected, nextJustification, "selection");
  }

  function updateJustification(value: string) {
    setJustification(value);
    if (!action) return;
    persistDraft(action, value, "text");
  }

  function applyPreset(preset: string) {
    setJustification(preset);
    if (!action) return;
    persistDraft(action, preset, "selection");
  }

  async function confirmVerdict() {
    if (!action) return;
    setSubmitting(true);
    setError(null);
    try {
      if (draftAutosave) {
        await draftAutosave.flushTarget("evidence", document.id, null);
      }
      await onVerdict(document.id, action, justification.trim());
      notify.success(EVIDENCE_ACTION_SUCCESS[action]);
      draftAutosave?.clearDraftMemory("evidence", document.id, null);
      setAction(null);
      setJustification("");
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

  function cancelDecision() {
    setAction(null);
    setJustification("");
    setError(null);
    if (decided) setChangingDecision(false);
  }

  return (
    <div
      ref={containerRef}
      id={`evidence-${document.id}`}
      tabIndex={-1}
      data-highlighted={highlighted ? "true" : undefined}
      className={`scroll-mt-24 flex overflow-hidden rounded-xl border bg-white shadow-sm outline-none transition ${
        highlighted
          ? "border-brand-400 ring-2 ring-brand-300 ring-offset-2"
          : "border-slate-200/80 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      }`}
    >
      <span className="w-1 shrink-0 bg-brand-400" aria-hidden />
      <div className="min-w-0 flex-1 space-y-4 p-3.5 sm:p-4">
        <EvidenceDocumentSummary document={document} />

      {decided && decisionMeta ? (
        <p className="text-xs text-slate-500">{decisionMeta}</p>
      ) : null}
      {document.justification &&
      (document.status === "invalidated" ||
        document.status === "adjustment_requested") ? (
        <p className="text-sm leading-relaxed text-slate-600">
          Motivo: {document.justification}
        </p>
      ) : null}

      {decided && !changingDecision && !action ? (
        <button
          type="button"
          disabled={disabled || submitting}
          onClick={() => {
            setChangingDecision(true);
            setError(null);
          }}
          className={formSurface.secondaryButtonSm}
        >
          Alterar decisão
        </button>
      ) : null}

      {!action && (document.analysisDraft || confirmedFlash) ? (
        <ValidationAutosaveIndicator
          state={draftAutosave?.getStatus(targetKey)}
          onRetry={() => draftAutosave?.retry(targetKey)}
          confirmed={confirmedFlash}
          confirmedLabel={VALIDATION_ANALYSIS_CONFIRMED_LABEL}
        />
      ) : null}

      {showActions && evidenceActions.primaryActions.length > 0 ? (
        <section
          className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-3.5 sm:p-4"
          aria-labelledby={`evidence-decision-${document.id}`}
        >
          <div>
            <h5
              id={`evidence-decision-${document.id}`}
              className={criterionSection.title}
            >
              Decisão sobre esta evidência
            </h5>
            <p className={criterionSection.description}>
              Analise a evidência e selecione o resultado da validação.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {evidenceActions.primaryActions
              .filter(
                (primaryAction): primaryAction is EvidenceDecisionAction =>
                  primaryAction === "approve" ||
                  primaryAction === "invalidate" ||
                  primaryAction === "request_adjustment",
              )
              .map((primaryAction) => {
                const isActive = action === primaryAction;
                return (
                  <button
                    key={primaryAction}
                    type="button"
                    disabled={disabled || submitting}
                    aria-pressed={isActive}
                    onClick={() => selectAction(primaryAction)}
                    className={evidenceDecisionButtonClass(
                      primaryAction,
                      isActive,
                    )}
                  >
                    {EVIDENCE_ACTION_LABEL[primaryAction]}
                  </button>
                );
              })}
          </div>

          {action ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 sm:p-4">
              {needsJustification ? (
                <div className="space-y-3">
                  <div className={formSurface.fieldGroup}>
                    <p className={formSurface.label}>Respostas padrão</p>
                    <div className="flex flex-wrap gap-2">
                      {EVIDENCE_JUSTIFICATION_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          aria-pressed={justification === preset}
                          disabled={submitting || disabled}
                          onClick={() => applyPreset(preset)}
                          className={[
                            formSurface.badge.base,
                            "transition disabled:cursor-not-allowed disabled:opacity-50",
                            justification === preset
                              ? formSurface.badge.brand
                              : `${formSurface.badge.neutral} hover:bg-slate-500`,
                          ].join(" ")}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className={formSurface.fieldGroup}>
                    <span className={formSurface.label}>Justificativa</span>
                    <textarea
                      value={justification}
                      onChange={(event) =>
                        updateJustification(event.target.value)
                      }
                      placeholder="Selecione uma resposta padrão ou escreva uma justificativa"
                      rows={3}
                      maxLength={2000}
                      disabled={submitting || disabled}
                      className={formSurface.inputTextarea}
                    />
                  </label>
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  Confirme a aprovação desta evidência.
                </p>
              )}

              <ValidationAutosaveIndicator
                state={draftAutosave?.getStatus(targetKey)}
                onRetry={() => draftAutosave?.retry(targetKey)}
                confirmed={confirmedFlash}
                confirmedLabel={VALIDATION_ANALYSIS_CONFIRMED_LABEL}
              />

              {error ? (
                <p
                  role="alert"
                  aria-live="assertive"
                  className={formSurface.messageError}
                >
                  {error}
                </p>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <LoadingButton
                  type="button"
                  pending={submitting}
                  pendingLabel="Registrando…"
                  disabled={!canSubmit}
                  onClick={() => void confirmVerdict()}
                  className={`${formSurface.primaryButtonSm} w-full sm:w-auto`}
                >
                  Confirmar: {EVIDENCE_ACTION_LABEL[action]}
                </LoadingButton>
                <button
                  type="button"
                  disabled={submitting || disabled}
                  onClick={cancelDecision}
                  className={`${formSurface.ghostButton} w-full sm:w-auto`}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
      </div>
    </div>
  );
}
