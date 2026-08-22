"use client";

import {
  VALIDATION_AUTOSAVE_ERROR_MESSAGE,
  VALIDATION_AUTOSAVE_SAVED_LABEL,
  VALIDATION_AUTOSAVE_SAVING_LABEL,
  type ValidationAutosaveState,
} from "../validation-analysis-autosave";

type Props = {
  state?: ValidationAutosaveState;
  onRetry?: () => void;
  errorId?: string;
  confirmed?: boolean;
  confirmedLabel?: string;
};

/**
 * Indicador discreto de rascunho. Evita toast e distingue rascunho de veredito.
 */
export function ValidationAutosaveIndicator({
  state,
  onRetry,
  errorId,
  confirmed = false,
  confirmedLabel = "Análise confirmada",
}: Props) {
  if (confirmed) {
    return (
      <p className="mt-2 text-xs font-medium text-emerald-700" aria-live="polite">
        {confirmedLabel}
      </p>
    );
  }

  if (!state || state.status === "idle") return null;

  if (state.status === "saving") {
    return (
      <p className="mt-2 text-xs font-medium text-brand-700" aria-live="polite">
        {VALIDATION_AUTOSAVE_SAVING_LABEL}
      </p>
    );
  }

  if (state.status === "saved") {
    return (
      <p className="mt-2 text-xs font-medium text-emerald-700" aria-live="polite">
        {VALIDATION_AUTOSAVE_SAVED_LABEL}
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-1" role="alert" aria-live="assertive">
      <p id={errorId} className="text-xs font-medium text-rose-700">
        {state.errorMessage?.trim() || VALIDATION_AUTOSAVE_ERROR_MESSAGE}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-xs font-semibold text-rose-800 underline underline-offset-2 hover:text-rose-950"
        >
          Tentar novamente
        </button>
      ) : null}
    </div>
  );
}
