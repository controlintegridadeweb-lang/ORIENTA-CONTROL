"use client";

import { AUTOSAVE_ERROR_MESSAGE, type CriterionAutosaveState } from "../criterion-answer-autosave";

type Props = {
  state?: CriterionAutosaveState;
  onRetry?: () => void;
  errorId?: string;
};

/**
 * Indicador discreto de autosave por critério.
 * Não usa toast — evita ruído a cada resposta salva.
 */
export function CriterionAutosaveIndicator({ state, onRetry, errorId }: Props) {
  if (!state || state.status === "idle") return null;

  if (state.status === "saving") {
    return (
      <p className="mt-2 text-xs font-medium text-brand-700" aria-live="polite">
        Salvando...
      </p>
    );
  }

  if (state.status === "saved") {
    return (
      <p className="mt-2 text-xs font-medium text-emerald-700" aria-live="polite">
        Salvo
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-1" role="alert" aria-live="assertive">
      <p id={errorId} className="text-xs font-medium text-rose-700">
        {state.errorMessage?.trim() || AUTOSAVE_ERROR_MESSAGE}
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
