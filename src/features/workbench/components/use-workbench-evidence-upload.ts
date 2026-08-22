"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { uploadEvidenceFile } from "@/infrastructure/client/workbench-api";
import { parseJson } from "@/infrastructure/api/fetch-client";
import { workbenchUploadResponseSchema } from "@/features/workbench/http-contracts";
import { MAX_EVIDENCES_PER_SAVE } from "@/features/workbench/evidence-limits";
import type { EvidenceDraft } from "@/features/workbench/evidence-draft";
import { countLabel } from "@/shared/format/count-label";
import type { WorkbenchFeedback, WorkbenchIds } from "./workbench-types";
import { emptyEvidenceDraft, type Row } from "./workbench-helpers";
import type { WorkbenchEvidenceDraftController } from "./use-workbench-evidence-drafts";

export function useWorkbenchEvidenceUpload({
  ids,
  setFeedback,
  drafts,
  reportFailure,
}: {
  ids: WorkbenchIds;
  setFeedback: Dispatch<SetStateAction<WorkbenchFeedback | null>>;
  drafts: WorkbenchEvidenceDraftController;
  reportFailure: (error: unknown, fallback: string) => void;
}) {
  const [uploadingQuestionId, setUploadingQuestionId] = useState<string | null>(
    null,
  );

  const handleEvidenceKindChange = useCallback(
    async (row: Row, kind: "file" | "link" | "text") => {
      const current = drafts.evidenceDrafts[row.questionId];
      if (
        (kind === "link" || kind === "text") &&
        (current?.attachments?.length ?? 0) >= MAX_EVIDENCES_PER_SAVE
      ) {
        setFeedback({
          tone: "warning",
          title: "Limite de evidências atingido",
          description: `Cada salvamento aceita no máximo ${MAX_EVIDENCES_PER_SAVE} evidências.`,
        });
        return;
      }
      drafts.updateEvidenceDraft(row.questionId, {
        kind,
        storagePath: kind === "file" ? (current?.storagePath ?? null) : null,
        pendingUploadId:
          kind === "file" ? (current?.pendingUploadId ?? null) : null,
        externalLink: kind === "link" ? (current?.externalLink ?? "") : "",
        textBody: kind === "text" ? (current?.textBody ?? "") : "",
        title:
          kind === "text" && !(current?.title ?? "").trim()
            ? "Comprovação textual"
            : (current?.title ?? ""),
      });
    },
    [drafts, setFeedback],
  );

  const handleEvidenceFile = useCallback(
    async (row: Row, selected: File | File[]) => {
      const files = Array.isArray(selected) ? selected : [selected];
      if (files.length === 0) return;
      const currentDraft =
        drafts.evidenceDrafts[row.questionId] ?? emptyEvidenceDraft();
      const acceptedFiles = selectAcceptedFiles(currentDraft, files, setFeedback);
      if (acceptedFiles.length === 0) return;

      setUploadingQuestionId(row.questionId);
      if (acceptedFiles.length === files.length) setFeedback(null);
      try {
        for (const file of acceptedFiles) {
          const response = await uploadEvidenceFile(ids, file);
          const body = await parseJson(response, workbenchUploadResponseSchema);
          if (!response.ok || !body.storagePath || !body.pendingUploadId) {
            reportFailure(
              typeof body.error === "string" ? body.error : undefined,
              `Falha no upload de ${file.name}.`,
            );
            continue;
          }
          drafts.appendUploadedFile({
            questionId: row.questionId,
            pendingUploadId: body.pendingUploadId,
            storagePath: body.storagePath,
            fileName: file.name,
          });
        }
      } catch (caught: unknown) {
        reportFailure(
          caught,
          "Falha de conexão durante o upload da evidência.",
        );
      } finally {
        setUploadingQuestionId(null);
      }
    },
    [drafts, ids, reportFailure, setFeedback],
  );

  return {
    uploadingQuestionId,
    handleEvidenceKindChange,
    handleEvidenceFile,
  };
}

function selectAcceptedFiles(
  draft: EvidenceDraft,
  files: File[],
  setFeedback: Dispatch<SetStateAction<WorkbenchFeedback | null>>,
) {
  const reservedForLink =
    draft.kind === "link" &&
    draft.externalLink.trim() &&
    draft.title.trim()
      ? 1
      : 0;
  const available = Math.max(
    0,
    MAX_EVIDENCES_PER_SAVE -
      (draft.attachments?.length ?? 0) -
      reservedForLink,
  );
  if (available === 0) {
    setFeedback({
      tone: "warning",
      title: "Limite de evidências atingido",
      description: `Cada salvamento aceita no máximo ${MAX_EVIDENCES_PER_SAVE} evidências. Remova um item antes de adicionar outro.`,
    });
    return [];
  }
  const acceptedFiles = files.slice(0, available);
  if (acceptedFiles.length < files.length) {
    setFeedback({
      tone: "warning",
      title: "Alguns arquivos não foram adicionados",
      description: `Foram aceitos ${countLabel(acceptedFiles.length, "arquivo", "arquivos")} para respeitar o limite de ${MAX_EVIDENCES_PER_SAVE} evidências por salvamento.`,
    });
  }
  return acceptedFiles;
}
