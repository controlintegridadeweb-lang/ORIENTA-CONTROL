"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { removeEvidenceAttachment } from "@/infrastructure/client/workbench-api";
import { useConfirm } from "@/shared/ui/components/confirm-dialog";
import { notify } from "@/infrastructure/notifications/notify";
import type { WorkbenchFeedback, WorkbenchIds } from "./workbench-types";
import { emptyEvidenceDraft, type Row } from "./workbench-helpers";
import { readResponseError } from "./workbench-response-http";
import type { WorkbenchEvidenceDraftController } from "./use-workbench-evidence-drafts";

export function useWorkbenchEvidenceRemoval({
  ids,
  loadWorkbench,
  setFeedback,
  setSavingQuestionId,
  drafts,
  reportFailure,
}: {
  ids: WorkbenchIds;
  loadWorkbench: () => Promise<boolean>;
  setFeedback: Dispatch<SetStateAction<WorkbenchFeedback | null>>;
  setSavingQuestionId: Dispatch<SetStateAction<string | null>>;
  drafts: WorkbenchEvidenceDraftController;
  reportFailure: (error: unknown, fallback: string) => void;
}) {
  const confirm = useConfirm();

  const discardPendingUpload = useCallback(
    async (row: Row): Promise<boolean> => {
      const draft = drafts.evidenceDrafts[row.questionId] ?? emptyEvidenceDraft();
      const pendingUploadIds = [
        draft.pendingUploadId,
        ...(draft.attachments ?? []).map((item) => item.pendingUploadId),
      ].filter((id): id is string => Boolean(id));
      if (pendingUploadIds.length === 0) return true;

      try {
        for (const pendingUploadId of pendingUploadIds) {
          const response = await removeEvidenceAttachment(ids, {
            questionId: row.questionId,
            pendingUploadId,
          });
          if (!response.ok) {
            const message = await readResponseError(
              response,
              "Falha ao descartar arquivo temporário.",
            );
            reportFailure(message, "Falha ao descartar arquivo temporário.");
            return false;
          }
          drafts.clearIfPendingUpload(row.questionId, pendingUploadId);
        }
        return true;
      } catch (caught: unknown) {
        reportFailure(
          caught,
          "Falha de conexão ao descartar o arquivo temporário.",
        );
        return false;
      }
    },
    [drafts, ids, reportFailure],
  );

  const removePendingUpload = useCallback(
    async (row: Row, pendingUploadId: string) => {
      setSavingQuestionId(row.questionId);
      setFeedback(null);
      try {
        const response = await removeEvidenceAttachment(ids, {
          questionId: row.questionId,
          pendingUploadId,
        });
        if (!response.ok) {
          reportFailure(
            await readResponseError(
              response,
              "Falha ao descartar arquivo temporário.",
            ),
            "Falha ao descartar arquivo temporário.",
          );
          return;
        }
        drafts.clearIfPendingUpload(row.questionId, pendingUploadId);
        notify.success("Arquivo temporário removido.");
      } catch (caught: unknown) {
        reportFailure(caught, "Falha ao remover o arquivo temporário.");
      } finally {
        setSavingQuestionId(null);
      }
    },
    [drafts, ids, reportFailure, setFeedback, setSavingQuestionId],
  );

  const handleRemoveEvidence = useCallback(
    async (
      row: Row,
      attachment?: {
        evidenceId?: string;
        pendingUploadId?: string;
        clientId?: string;
      },
    ) => {
      const confirmed = await confirm({
        title: "Remover evidência?",
        description: "O anexo ou link desta evidência será removido.",
        confirmLabel: "Remover",
        tone: "danger",
      });
      if (!confirmed) return;

      const draftSnapshot =
        drafts.evidenceDrafts[row.questionId] ?? emptyEvidenceDraft();
      const persistedEvidenceId = attachment?.evidenceId ?? row.evidenceId;
      const targetPendingUploadId =
        attachment?.pendingUploadId ?? draftSnapshot.pendingUploadId;

      if (targetPendingUploadId) {
        await removePendingUpload(row, targetPendingUploadId);
        return;
      }

      const isLinkOnlyDraft = Boolean(
        draftSnapshot.kind === "link" &&
          draftSnapshot.externalLink?.trim() &&
          !persistedEvidenceId,
      );
      if (isLinkOnlyDraft) {
        drafts.updateEvidenceDraft(row.questionId, {
          kind: null,
          storagePath: null,
          pendingUploadId: null,
          externalLink: "",
          title: "",
          description: "",
        });
        notify.success("Link removido.");
        return;
      }

      setSavingQuestionId(row.questionId);
      setFeedback(null);
      try {
        const response = await removeEvidenceAttachment(ids, {
          questionId: row.questionId,
          evidenceId: persistedEvidenceId,
          expectedRevision: row.responseRevision,
        });
        if (!response.ok) {
          reportFailure(
            await readResponseError(response, "Falha ao remover anexo."),
            "Falha ao remover anexo.",
          );
          return;
        }
        drafts.clearAfterPersistedRemoval(
          row.questionId,
          draftSnapshot.pendingUploadId,
        );
        await loadWorkbench();
        notify.success("Anexo removido.");
      } catch (caught: unknown) {
        reportFailure(caught, "Falha de conexão ao remover o anexo.");
      } finally {
        setSavingQuestionId(null);
      }
    },
    [
      confirm,
      drafts,
      ids,
      loadWorkbench,
      removePendingUpload,
      reportFailure,
      setFeedback,
      setSavingQuestionId,
    ],
  );

  return { discardPendingUpload, handleRemoveEvidence };
}
