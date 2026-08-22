"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { describeError } from "@/infrastructure/notifications/notify";
import type { WorkbenchFeedback, WorkbenchIds } from "./workbench-types";
import { useWorkbenchEvidenceDrafts } from "./use-workbench-evidence-drafts";
import { useWorkbenchEvidenceRemoval } from "./use-workbench-evidence-removal";
import { useWorkbenchEvidenceUpload } from "./use-workbench-evidence-upload";

type UseWorkbenchEvidenceParams = {
  ids: WorkbenchIds;
  loadWorkbench: () => Promise<boolean>;
  setFeedback: Dispatch<SetStateAction<WorkbenchFeedback | null>>;
  setSavingQuestionId: Dispatch<SetStateAction<string | null>>;
};

/** Coordena rascunhos, upload e remoção das evidências do workbench. */
export function useWorkbenchEvidence({
  ids,
  loadWorkbench,
  setFeedback,
  setSavingQuestionId,
}: UseWorkbenchEvidenceParams) {
  const drafts = useWorkbenchEvidenceDrafts();
  const reportFailure = useCallback(
    (error: unknown, fallback: string) => {
      setFeedback({
        tone: "error",
        title: "Não foi possível atualizar a evidência",
        description: describeError(error, fallback),
      });
    },
    [setFeedback],
  );
  const removal = useWorkbenchEvidenceRemoval({
    ids,
    loadWorkbench,
    setFeedback,
    setSavingQuestionId,
    drafts,
    reportFailure,
  });
  const upload = useWorkbenchEvidenceUpload({
    ids,
    setFeedback,
    drafts,
    reportFailure,
  });

  return {
    evidenceDrafts: drafts.evidenceDrafts,
    uploadingQuestionId: upload.uploadingQuestionId,
    updateEvidenceDraft: drafts.updateEvidenceDraft,
    updateEvidenceAttachment: drafts.updateEvidenceAttachment,
    clearEvidenceDraft: drafts.clearEvidenceDraft,
    discardPendingUpload: removal.discardPendingUpload,
    handleRemoveEvidence: removal.handleRemoveEvidence,
    handleEvidenceKindChange: upload.handleEvidenceKindChange,
    handleEvidenceFile: upload.handleEvidenceFile,
  };
}
