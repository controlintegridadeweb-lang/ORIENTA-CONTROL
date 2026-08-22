"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useValidationAnalysisAutosave } from "../use-validation-analysis-autosave";
import {
  useValidationAnalysisDraftPersistence,
  type ValidationAnalysisDraftPersistence,
} from "../use-validation-analysis-draft-persistence";

const ValidationDraftAutosaveContext =
  createContext<ValidationAnalysisDraftPersistence | null>(null);

export function ValidationDraftAutosaveProvider({
  cycleId,
  disabled = false,
  children,
}: {
  cycleId: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const autosave = useValidationAnalysisAutosave();
  const persistence = useValidationAnalysisDraftPersistence({
    cycleId,
    autosave,
    disabled,
  });

  return (
    <ValidationDraftAutosaveContext.Provider value={persistence}>
      {children}
    </ValidationDraftAutosaveContext.Provider>
  );
}

export function useValidationDraftAutosave(): ValidationAnalysisDraftPersistence {
  const value = useContext(ValidationDraftAutosaveContext);
  if (!value) {
    throw new Error(
      "useValidationDraftAutosave deve ser usado dentro de ValidationDraftAutosaveProvider.",
    );
  }
  return value;
}

export function useOptionalValidationDraftAutosave(): ValidationAnalysisDraftPersistence | null {
  return useContext(ValidationDraftAutosaveContext);
}
