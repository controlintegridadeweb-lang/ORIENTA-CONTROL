"use client";

import { Check, FileWarning, Paperclip } from "lucide-react";
import type { WorkbenchRow } from "@/features/workbench/load-workbench-payload";
import { resolvePersistedEvidences } from "./resolve-persisted-evidences";

export type EvidenceStatusAnswer = "yes" | "no" | "not_applicable" | null;

/**
 * Estado consolidado das evidências vinculadas à resposta.
 * Precedência: approved > pending/insufficient/rejected > not_submitted.
 */
export type ResolvedEvidenceStatus =
  | "approved"
  | "pending"
  | "insufficient"
  | "rejected"
  | "not_submitted";

export type EvidenceStatusMessageContent = {
  title: string;
  body?: string;
  tone: "neutral" | "amber" | "emerald" | "rose";
};

export type EvidencePendingModality = "text" | "other";

export type EvidenceStatusMessageInput = {
  answer: EvidenceStatusAnswer;
  evidenceRequired: boolean;
  evidenceStatus: ResolvedEvidenceStatus;
  diagnosisStatus?: string | null;
  /** Quando pending e só há comprovação textual, usa copy específica. */
  pendingModality?: EvidencePendingModality;
};

/**
 * Consolida o estado da comprovação a partir da mesma lista usada na UI.
 * Lista vazia → not_submitted; evidência válida → estado oficial correspondente.
 */
export function resolveEvidenceStatus(
  row: Pick<
    WorkbenchRow,
    | "evidenceId"
    | "evidenceTitle"
    | "evidenceDescription"
    | "storagePath"
    | "externalLink"
    | "textBody"
    | "validationStatus"
    | "validationJustification"
    | "hasAdjustmentRequest"
    | "evidences"
  >,
): ResolvedEvidenceStatus {
  const evidences = resolvePersistedEvidences(row);
  if (evidences.length === 0) {
    return "not_submitted";
  }

  const statuses = evidences
    .map((item) => item.validationStatus)
    .filter((status): status is string => Boolean(status));

  if (statuses.some((status) => status === "approved")) {
    return "approved";
  }

  if (
    statuses.some(
      (status) => status === "invalidated" || status === "insufficient_evidence",
    )
  ) {
    return "insufficient";
  }

  if (
    row.hasAdjustmentRequest ||
    statuses.some((status) => status === "adjustment_requested")
  ) {
    return "rejected";
  }

  return "pending";
}

/** Modalidade do pending: textual pura vs arquivo/link/misto. */
export function resolvePendingModality(
  row: Pick<WorkbenchRow, "evidences" | "storagePath" | "externalLink" | "textBody" | "evidenceId" | "evidenceTitle" | "evidenceDescription" | "validationStatus" | "validationJustification">,
): EvidencePendingModality {
  const evidences = resolvePersistedEvidences(row);
  if (evidences.length === 0) return "other";
  return evidences.every((item) => item.kind === "text") ? "text" : "other";
}

/** Conteúdo único da mensagem conforme o estado consolidado. */
export function resolveEvidenceStatusMessage(
  input: EvidenceStatusMessageInput,
): EvidenceStatusMessageContent | null {
  if (!input.evidenceRequired || input.answer !== "yes") {
    return null;
  }

  switch (input.evidenceStatus) {
    case "approved":
      return {
        title: "Comprovação aprovada.",
        tone: "emerald",
      };
    case "pending":
      return {
        title:
          input.pendingModality === "text"
            ? "Comprovação textual enviada e aguardando validação."
            : "Evidência enviada e aguardando validação.",
        tone: "amber",
      };
    case "insufficient":
    case "rejected":
      return {
        title: "Comprovação considerada insuficiente.",
        tone: "rose",
      };
    case "not_submitted":
    default:
      return {
        title: "Resposta positiva sem comprovação.",
        tone: "neutral",
      };
  }
}

const TONE_CLASS: Record<EvidenceStatusMessageContent["tone"], string> = {
  neutral: "text-slate-600",
  amber: "text-amber-900",
  emerald: "text-emerald-800",
  rose: "text-rose-800",
};

const ICON_CLASS: Record<EvidenceStatusMessageContent["tone"], string> = {
  neutral: "text-slate-400",
  amber: "text-amber-600",
  emerald: "text-emerald-600",
  rose: "text-rose-600",
};

type Props = EvidenceStatusMessageInput;

/**
 * Única mensagem contextual do estado da evidência no critério.
 * Não combine com outra orientação genérica do mesmo critério.
 */
export function EvidenceStatusMessage(props: Props) {
  const content = resolveEvidenceStatusMessage(props);
  if (!content) return null;

  const Icon =
    content.tone === "emerald"
      ? Check
      : content.tone === "rose" || content.tone === "amber"
        ? FileWarning
        : Paperclip;

  return (
    <p
      className={`flex items-start gap-2 text-sm leading-snug ${TONE_CLASS[content.tone]}`}
      role="note"
      data-evidence-status-message={props.evidenceStatus}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${ICON_CLASS[content.tone]}`} aria-hidden />
      <span>
        <span className="font-medium text-slate-800">{content.title}</span>
        {content.body ? <> {content.body}</> : null}
      </span>
    </p>
  );
}
