"use client";

import { AlertCircle, Check, FileWarning } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";
import type { WorkbenchRow } from "@/features/workbench/load-workbench-payload";

export { resolveEvidenceSectionDescription } from "./evidence-section-description";
export { EvidenceDetails } from "./respondent-evidence-details";

type StatusTone = "neutral" | "amber" | "emerald" | "rose";
type StatusHint = { tone: StatusTone; text: string };

const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  neutral: "text-slate-600",
  amber: "text-amber-900",
  emerald: "text-emerald-800",
  rose: "text-rose-800",
};

function StatusMessage({ hint }: { hint: StatusHint }) {
  return (
    <p className={`flex items-start gap-2 text-sm leading-snug ${STATUS_TONE_CLASS[hint.tone]}`}>
      {hint.tone === "emerald" ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      ) : hint.tone === "amber" || hint.tone === "rose" ? (
        <FileWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
      )}
      <span>{hint.text}</span>
    </p>
  );
}

function notApplicableHint(row: WorkbenchRow, pending: boolean): StatusHint | null {
  if (row.answer === "not_applicable" && row.naValidationStatus === "pending") {
    return { tone: "amber", text: "Aguardando validação da administração." };
  }
  if (row.answer === "not_applicable" && row.naValidationStatus === "approved") {
    return { tone: "emerald", text: "“Não se aplica” aceito pela administração." };
  }
  if (pending) {
    return {
      tone: "neutral",
      text: "Descreva por que a pergunta não se aplica neste diagnóstico. A justificativa é salva automaticamente.",
    };
  }
  return null;
}

type NotApplicableDetailsProps = {
  row: WorkbenchRow;
  visible: boolean;
  pending: boolean;
  draft: string;
  error?: string;
  disabled?: boolean;
  busy: boolean;
  readOnly?: boolean;
  onChange?: (questionId: string, value: string) => void;
  onSave?: (row: WorkbenchRow) => Promise<boolean>;
};

export function NotApplicableDetails({
  row,
  visible,
  pending,
  draft,
  error,
  disabled,
  busy,
  readOnly,
  onChange,
  onSave,
}: NotApplicableDetailsProps) {
  if (!visible) {
    if (row.answer !== "no" || !row.naRejectionReason) return null;
    return (
      <p
        className={`mt-4 flex items-start gap-2 text-sm leading-snug ${STATUS_TONE_CLASS.rose}`}
        role="status"
      >
        <FileWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          A administração não aceitou o “não se aplica”. A resposta passou a ser “Não”.
          {row.naRejectionReason.trim() ? ` Motivo: ${row.naRejectionReason.trim()}` : ""}
        </span>
      </p>
    );
  }

  const hint = notApplicableHint(row, pending);

  return (
    <div className="mt-5 space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
      {hint ? <StatusMessage hint={hint} /> : null}

      <div className={formSurface.fieldGroup}>
        <label htmlFor={`na-just-${row.questionId}`} className={formSurface.label}>
          Justificativa <span className="text-rose-600">*</span>
        </label>
        <p className="text-sm text-slate-600">
          Explique por que esta pergunta não se aplica neste diagnóstico (mínimo 20 caracteres).
        </p>
        <textarea
          id={`na-just-${row.questionId}`}
          value={draft}
          onChange={(event) => onChange?.(row.questionId, event.target.value)}
          disabled={Boolean(disabled || busy || readOnly || row.naValidationStatus === "approved")}
          rows={3}
          maxLength={4000}
          placeholder="Descreva o motivo com clareza…"
          className={`${formSurface.inputTextarea} ${
            error ? "border-rose-400 ring-1 ring-rose-200" : ""
          }`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `na-just-error-${row.questionId}` : undefined}
        />
        {error ? (
          <p id={`na-just-error-${row.questionId}`} className="text-sm text-rose-600" role="alert">
            {error}
          </p>
        ) : null}
        {!readOnly && onSave && row.naValidationStatus !== "approved" ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void onSave(row)}
              disabled={Boolean(disabled || busy)}
              className={formSurface.primaryButtonSm}
            >
              Salvar justificativa
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
