"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { LoadingButton } from "@/shared/ui/components/loading";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import type { ValidationReopenImpact } from "@/features/cycles/client";
import { trapTabFocus } from "@/shared/accessibility/focus-trap";

const MIN_REASON_LENGTH = 10;

export type ReopenValidationModalProps = {
  open: boolean;
  pending?: boolean;
  impact?: ValidationReopenImpact | null;
  impactLoading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
};

/**
 * Modal de confirmação para reabrir a validação.
 * O motivo só é validado após tentativa de confirmação.
 * Remonte com `key` ao abrir para limpar o formulário.
 */
export function ReopenValidationModal({
  open,
  pending = false,
  impact = null,
  impactLoading = false,
  onClose,
  onConfirm,
}: ReopenValidationModalProps) {
  const titleId = useId();
  const descId = useId();
  const fieldId = useId();
  const errorId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState("");
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose, pending]);

  if (!open) return null;

  const trimmed = reason.trim();
  const reasonInvalid = trimmed.length < MIN_REASON_LENGTH;
  const showError = attempted && reasonInvalid;
  const blocked = Boolean(impact?.blocked);

  async function handleConfirm() {
    setAttempted(true);
    if (reasonInvalid || blocked || impactLoading) {
      textareaRef.current?.focus();
      return;
    }
    await onConfirm(trimmed);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <button
        type="button"
        aria-label="Cancelar"
        className="absolute inset-0 cursor-default"
        onClick={() => {
          if (!pending) onClose();
        }}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        className="relative flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-100/80"
        onKeyDown={(event) => trapTabFocus(event, panelRef.current)}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className={typography.subsectionTitle}>
              Reabrir validação
            </h2>
            <p id={descId} className={`mt-1 ${typography.sectionDescription}`}>
              Uma nova rodada de validação será iniciada. As decisões e o
              Resultado FAMI anteriores serão preservados no histórico. Depois
              que a nova validação for concluída, será gerado um novo Resultado
              FAMI oficial.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="shrink-0 rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4 sm:px-6">
          <label htmlFor={fieldId} className={formSurface.fieldGroup}>
            <span className={formSurface.label}>Motivo da reabertura</span>
            <textarea
              ref={textareaRef}
              id={fieldId}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              maxLength={2000}
              disabled={pending}
              placeholder="Explique por que a validação precisa ser revisada."
              aria-invalid={showError}
              aria-describedby={showError ? errorId : undefined}
              className={formSurface.inputTextarea}
            />
          </label>
          {impactLoading ? (
            <p role="status" className={formSurface.messageNeutral}>
              Verificando ações, supervisões e exceções vinculadas…
            </p>
          ) : impact ? (
            <div className={blocked ? formSurface.messageError : formSurface.messageNeutral}>
              <p className="font-semibold">Impacto identificado</p>
              <p className="mt-1">
                {impact.actionPlanCount} ação(ões), {impact.supervisionNoteCount} registro(s) de supervisão e {impact.exceptionCount} exceção(ões).
              </p>
              {blocked ? (
                <p className="mt-2">
                  A reabertura foi bloqueada para não desconectar o histórico. Abra um novo diagnóstico para realizar uma nova avaliação.
                </p>
              ) : null}
            </div>
          ) : null}
          {showError ? (
            <p id={errorId} role="alert" className={formSurface.messageError}>
              Informe o motivo da reabertura com pelo menos {MIN_REASON_LENGTH}{" "}
              caracteres.
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className={`${formSurface.secondaryButton} w-full sm:w-auto`}
          >
            Cancelar
          </button>
          <LoadingButton
            type="button"
            pending={pending}
            pendingLabel="Reabrindo…"
            disabled={pending || impactLoading || blocked}
            onClick={() => void handleConfirm()}
            className={`${formSurface.primaryButton} w-full sm:w-auto`}
          >
            Reabrir validação
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
