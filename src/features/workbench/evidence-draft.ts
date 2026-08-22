export type EvidenceAttachmentDraft = {
  clientId: string;
  kind: "file" | "link" | "text";
  title: string;
  description: string;
  externalLink: string | null;
  storagePath: string | null;
  pendingUploadId: string | null;
  textBody?: string | null;
};

/** Estado local de uma evidência ainda não persistida no workbench. */
export type EvidenceDraft = {
  kind: "file" | "link" | "text" | null;
  title: string;
  description: string;
  externalLink: string;
  storagePath: string | null;
  /** Identidade do upload ainda não associado à evidência persistida. */
  pendingUploadId: string | null;
  /** Corpo da comprovação textual (modalidade text). */
  textBody: string;
  /** Novos anexos ainda não associados à resposta. */
  attachments?: EvidenceAttachmentDraft[];
};
