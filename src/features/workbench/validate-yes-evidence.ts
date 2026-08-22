export const EVIDENCE_ATTACHMENT_MESSAGE =
  "Esta pergunta exige comprovação. Envie um arquivo, informe um link ou registre uma comprovação textual.";

export const EVIDENCE_TITLE_MESSAGE = "Informe o título da evidência.";

export const EVIDENCE_PENDING_UPLOAD_MESSAGE =
  "O envio do arquivo foi interrompido. Envie o arquivo novamente antes de continuar.";

export type YesEvidenceFieldErrors = {
  attachment?: string;
  title?: string;
};

export type YesEvidenceValidationResult = {
  ok: boolean;
  errors: YesEvidenceFieldErrors;
};

export type YesEvidenceInput = {
  kind?: "file" | "link" | "text" | null;
  title?: string | null;
  storagePath?: string | null;
  externalLink?: string | null;
  textBody?: string | null;
};

function resolveAttachmentKind(
  input: YesEvidenceInput,
  server?: YesEvidenceInput | null,
): "file" | "link" | "text" | null {
  if (input.kind === "file" || input.kind === "link" || input.kind === "text") {
    return input.kind;
  }
  if (input.storagePath || server?.storagePath) return "file";
  if ((input.externalLink ?? server?.externalLink ?? "").trim()) return "link";
  if ((input.textBody ?? server?.textBody ?? "").trim()) return "text";
  return null;
}

function hasValidAttachment(
  kind: "file" | "link" | "text" | null,
  input: YesEvidenceInput,
  server?: YesEvidenceInput | null,
): boolean {
  if (kind === "file") {
    return Boolean(input.storagePath ?? server?.storagePath);
  }
  if (kind === "link") {
    return Boolean((input.externalLink ?? server?.externalLink ?? "").trim());
  }
  if (kind === "text") {
    return Boolean((input.textBody ?? server?.textBody ?? "").trim());
  }
  return (
    Boolean(input.storagePath ?? server?.storagePath) ||
    Boolean((input.externalLink ?? server?.externalLink ?? "").trim()) ||
    Boolean((input.textBody ?? server?.textBody ?? "").trim())
  );
}

/** Valida comprovante (arquivo, link ou texto) e título para resposta Sim com evidência obrigatória. */
export function validateYesWithEvidence(
  input: YesEvidenceInput,
  server?: YesEvidenceInput | null,
): YesEvidenceValidationResult {
  const kind = resolveAttachmentKind(input, server);
  const title = input.title?.trim() || server?.title?.trim() || "";
  const errors: YesEvidenceFieldErrors = {};

  if (!hasValidAttachment(kind, input, server)) {
    errors.attachment = EVIDENCE_ATTACHMENT_MESSAGE;
  }
  if (!title) {
    errors.title = EVIDENCE_TITLE_MESSAGE;
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

export function formatYesEvidenceErrors(errors: YesEvidenceFieldErrors): string {
  return [errors.attachment, errors.title].filter(Boolean).join(" ");
}
