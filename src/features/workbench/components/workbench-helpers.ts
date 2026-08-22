import type { EvidenceDraft } from "@/features/workbench/evidence-draft";
import type { WorkbenchRow } from "@/features/workbench/load-workbench-payload";

export type Mode = "respondent";
export type Row = WorkbenchRow;

export type WorkbenchPayload = {
  form: {
    id: string;
    name: string;
    version: number;
    state: string;
    responseDeadlineAt?: string | null;
    closedAt?: string | null;
  };
  rows: Row[];
  cycle: { id: string; state: string };
};

export function emptyEvidenceDraft(): EvidenceDraft {
  return {
    kind: null,
    title: "",
    description: "",
    externalLink: "",
    storagePath: null,
    pendingUploadId: null,
    textBody: "",
    attachments: [],
  };
}
