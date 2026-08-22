"use client";

import { useCallback, useState } from "react";
import type { EvidenceDraft } from "@/features/workbench/evidence-draft";
import { emptyEvidenceDraft } from "./workbench-helpers";

export function useWorkbenchEvidenceDrafts() {
  const [evidenceDrafts, setEvidenceDrafts] = useState<
    Record<string, EvidenceDraft>
  >({});

  const updateEvidenceDraft = useCallback(
    (questionId: string, patch: Partial<EvidenceDraft>) => {
      setEvidenceDrafts((current) => ({
        ...current,
        [questionId]: {
          ...(current[questionId] ?? emptyEvidenceDraft()),
          ...patch,
        },
      }));
    },
    [],
  );

  const updateEvidenceAttachment = useCallback(
    (
      questionId: string,
      clientId: string,
      patch: { title?: string; description?: string },
    ) => {
      setEvidenceDrafts((current) => {
        const draft = current[questionId];
        if (!draft) return current;
        return {
          ...current,
          [questionId]: {
            ...draft,
            attachments: (draft.attachments ?? []).map((item) =>
              item.clientId === clientId ? { ...item, ...patch } : item,
            ),
          },
        };
      });
    },
    [],
  );

  const clearEvidenceDraft = useCallback((questionId: string) => {
    setEvidenceDrafts((current) => withoutDraft(current, questionId));
  }, []);

  const clearIfPendingUpload = useCallback(
    (questionId: string, pendingUploadId: string) => {
      setEvidenceDrafts((current) => {
        const draft = current[questionId];
        if (!draft) return current;
        const currentAttachments = draft.attachments ?? [];
        if (currentAttachments.length > 0) {
          const attachments = currentAttachments.filter(
            (item) => item.pendingUploadId !== pendingUploadId,
          );
          if (attachments.length === currentAttachments.length) return current;
          return { ...current, [questionId]: { ...draft, attachments } };
        }
        return draft.pendingUploadId === pendingUploadId
          ? withoutDraft(current, questionId)
          : current;
      });
    },
    [],
  );

  const clearAfterPersistedRemoval = useCallback(
    (questionId: string, snapshotPendingUploadId: string | null) => {
      setEvidenceDrafts((current) => {
        const draft = current[questionId];
        if (!draft) return current;
        if ((draft.attachments ?? []).length > 0) return current;
        if (
          draft.pendingUploadId &&
          draft.pendingUploadId !== snapshotPendingUploadId
        ) {
          return current;
        }
        return withoutDraft(current, questionId);
      });
    },
    [],
  );

  const appendUploadedFile = useCallback(
    ({
      questionId,
      pendingUploadId,
      storagePath,
      fileName,
    }: {
      questionId: string;
      pendingUploadId: string;
      storagePath: string;
      fileName: string;
    }) => {
      setEvidenceDrafts((current) => {
        const draft = current[questionId] ?? emptyEvidenceDraft();
        return {
          ...current,
          [questionId]: {
            ...draft,
            kind: null,
            attachments: [
              ...(draft.attachments ?? []),
              {
                clientId: pendingUploadId,
                kind: "file",
                storagePath,
                pendingUploadId,
                externalLink: null,
                title: fileName.replace(/\.[^.]+$/, "") || "Evidência",
                description: "",
              },
            ],
          },
        };
      });
    },
    [],
  );

  return {
    evidenceDrafts,
    updateEvidenceDraft,
    updateEvidenceAttachment,
    clearEvidenceDraft,
    clearIfPendingUpload,
    clearAfterPersistedRemoval,
    appendUploadedFile,
  };
}

export type WorkbenchEvidenceDraftController = ReturnType<
  typeof useWorkbenchEvidenceDrafts
>;

function withoutDraft(
  current: Record<string, EvidenceDraft>,
  questionId: string,
) {
  if (!current[questionId]) return current;
  const next = { ...current };
  delete next[questionId];
  return next;
}
