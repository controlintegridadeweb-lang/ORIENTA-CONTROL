"use client";

import { useCallback } from "react";
import type { WorkbenchPayload } from "./workbench-helpers";
import { scrollToWorkbenchTarget } from "./scroll-workbench-target";

type Section = { name: string; rows: WorkbenchPayload["rows"] };

type Params = {
  groupedBySection: Section[];
  currentSectionIndex: number;
  setCurrentSectionIndex: (value: number | ((current: number) => number)) => void;
  setStepDirection: (direction: "forward" | "back") => void;
  advancingSection: boolean;
  setAdvancingSection: (value: boolean) => void;
  /** Bloqueia navegação apenas com upload/envio; autosave em voo não impede troca de seção. */
  uploadingQuestionId: string | null;
  submittingForm: boolean;
  /** Dispara flush de debounce textual antes de trocar de seção. */
  onBeforeNavigate?: () => void;
};


export function useWorkbenchSectionActions({
  groupedBySection,
  currentSectionIndex,
  setCurrentSectionIndex,
  setStepDirection,
  advancingSection,
  setAdvancingSection,
  uploadingQuestionId,
  submittingForm,
  onBeforeNavigate,
}: Params) {


  const handleSectionContinue = useCallback(() => {
    if (advancingSection || uploadingQuestionId) return;
    if (currentSectionIndex >= groupedBySection.length - 1) return;
    onBeforeNavigate?.();
    setAdvancingSection(true);
    try {
      setStepDirection("forward");
      setCurrentSectionIndex((index) => Math.min(index + 1, groupedBySection.length - 1));
      scrollToWorkbenchTarget();
    } finally {
      setAdvancingSection(false);
    }
  }, [
    advancingSection,
    currentSectionIndex,
    groupedBySection.length,
    onBeforeNavigate,
    setAdvancingSection,
    setCurrentSectionIndex,
    setStepDirection,
    uploadingQuestionId,
  ]);

  const handleSectionBack = useCallback(() => {
    if (currentSectionIndex <= 0 || advancingSection) return;
    onBeforeNavigate?.();
    setStepDirection("back");
    setCurrentSectionIndex((index) => Math.max(0, index - 1));
    scrollToWorkbenchTarget();
  }, [
    advancingSection,
    currentSectionIndex,
    onBeforeNavigate,
    setCurrentSectionIndex,
    setStepDirection,
  ]);

  const handleSectionSelect = useCallback((targetIndex: number) => {
    if (advancingSection || uploadingQuestionId || submittingForm) return;
    const safeTarget = Math.min(
      Math.max(0, targetIndex),
      Math.max(0, groupedBySection.length - 1),
    );
    if (safeTarget === currentSectionIndex) return;
    onBeforeNavigate?.();
    setStepDirection(safeTarget < currentSectionIndex ? "back" : "forward");
    setCurrentSectionIndex(safeTarget);
    scrollToWorkbenchTarget();
  }, [
    advancingSection,
    currentSectionIndex,
    groupedBySection.length,
    onBeforeNavigate,
    setCurrentSectionIndex,
    setStepDirection,
    submittingForm,
    uploadingQuestionId,
  ]);

  const handleReadOnlySectionNext = useCallback(() => {
    if (currentSectionIndex >= groupedBySection.length - 1 || advancingSection) return;
    setStepDirection("forward");
    setCurrentSectionIndex((index) => Math.min(index + 1, groupedBySection.length - 1));
    scrollToWorkbenchTarget();
  }, [
    advancingSection,
    currentSectionIndex,
    groupedBySection.length,
    setCurrentSectionIndex,
    setStepDirection,
  ]);

  return {
    handleSectionContinue,
    handleSectionBack,
    handleSectionSelect,
    handleReadOnlySectionNext,
  };
}
