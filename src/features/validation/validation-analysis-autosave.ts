export type ValidationAutosaveStatus = "idle" | "saving" | "saved" | "error";

export type ValidationAutosaveState = {
  status: ValidationAutosaveStatus;
  errorMessage?: string;
};

/** Debounce de campos textuais (justificativa/observação): 500–800 ms. */
export const VALIDATION_AUTOSAVE_TEXT_DEBOUNCE_MS = 600;

/** Tempo em que o indicador “Rascunho salvo” permanece visível. */
export const VALIDATION_AUTOSAVE_SAVED_VISIBLE_MS = 2500;

export const VALIDATION_AUTOSAVE_ERROR_MESSAGE =
  "Não foi possível salvar o rascunho";

export const VALIDATION_AUTOSAVE_SAVING_LABEL = "Salvando rascunho...";
export const VALIDATION_AUTOSAVE_SAVED_LABEL = "Rascunho salvo";
export const VALIDATION_ANALYSIS_CONFIRMED_LABEL = "Análise confirmada";

export function emptyValidationAutosaveState(): ValidationAutosaveState {
  return { status: "idle" };
}
