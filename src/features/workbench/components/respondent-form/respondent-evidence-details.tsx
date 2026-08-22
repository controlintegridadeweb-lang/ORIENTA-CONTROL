"use client";

import { AlertCircle, Check, FileText, FileWarning, Link2, Paperclip, Trash2, Type, Upload } from "lucide-react";
import { evidenceLabels, perguntaLabels } from "@/shared/labels/official-labels";
import { formSurface } from "@/shared/layout/form-surface";
import type { WorkbenchRow } from "@/features/workbench/load-workbench-payload";
import type { YesEvidenceFieldErrors } from "@/features/workbench/validate-yes-evidence";
import type { EvidenceDraft } from "@/features/workbench/evidence-draft";
import { resolveEvidenceStatus } from "./evidence-rule-message";
import { resolveEvidenceSectionDescription } from "./evidence-section-description";
import { hasResidualEvidenceFlatFields, resolvePersistedEvidences } from "./resolve-persisted-evidences";

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

function validationFeedbackText(row: WorkbenchRow): string | null {
  const fromEvidences = [...resolvePersistedEvidences(row)]
    .reverse()
    .find(
      (item) =>
        (item.validationStatus === "adjustment_requested" ||
          item.validationStatus === "invalidated") &&
        item.validationJustification?.trim(),
    )?.validationJustification;
  return fromEvidences?.trim() || row.validationJustification?.trim() || null;
}

function adjustmentCounts(row: WorkbenchRow) {
  const requested = row.adjustmentRequestCount ?? (row.hasAdjustmentRequest ? 1 : 0);
  const resolved = Math.min(
    requested,
    row.resolvedAdjustmentRequestCount ?? (row.hasResolvedAllAdjustments ? requested : 0),
  );
  const unresolved = Math.max(
    0,
    row.unresolvedAdjustmentRequestCount ?? requested - resolved,
  );
  return { requested, resolved, unresolved };
}

function evidenceHint(row: WorkbenchRow): StatusHint | null {
  const adjustment = adjustmentCounts(row);
  if (adjustment.requested > 0 && adjustment.unresolved === 0) {
    return {
      tone: "emerald",
      text:
        adjustment.requested === 1
          ? "Nova evidência registrada. Revise a correção e reenvie o diagnóstico."
          : `Todas as ${adjustment.requested} novas evidências foram registradas. Revise as correções e reenvie o diagnóstico.`,
    };
  }
  if (adjustment.requested > 0 && adjustment.resolved > 0) {
    return {
      tone: "amber",
      text: `${adjustment.resolved} de ${adjustment.requested} correções atendidas. Envie ${adjustment.unresolved} ${
        adjustment.unresolved === 1 ? "nova evidência" : "novas evidências"
      } para concluir esta pergunta.`,
    };
  }
  if (adjustment.requested > 0 || row.validationStatus === "adjustment_requested") {
    return {
      tone: "amber",
      text:
        adjustment.requested > 1
          ? `A administração devolveu ${adjustment.requested} evidências. Envie uma nova evidência para cada devolutiva.`
          : evidenceLabels.panelHint,
    };
  }

  // Estados de pontuação/comprovação ficam apenas em EvidenceStatusMessage.
  return null;
}

function canRemoveAttachment(row: WorkbenchRow, draft: EvidenceDraft): boolean {
  if (draft.kind === "file" && draft.storagePath) return true;
  if (draft.kind === "link" && (draft.externalLink.trim() !== "" || row.evidenceId)) return true;
  if (draft.kind === "text" && (draft.textBody.trim() !== "" || row.evidenceId)) return true;
  return Boolean(
    row.evidenceId && (row.storagePath || row.externalLink || row.textBody),
  );
}

type PersistedEvidence = ReturnType<typeof resolvePersistedEvidences>[number];

function PersistedEvidenceList({
  row,
  evidences,
  disabled,
  onRemoveAttachment,
}: {
  row: WorkbenchRow;
  evidences: PersistedEvidence[];
  disabled: boolean;
  onRemoveAttachment?: EvidenceDetailsProps["onRemoveAttachment"];
}) {
  if (evidences.length === 0) return null;

  return (
    <div className="space-y-2" aria-label="Evidências salvas">
      {evidences.map((item) => (
        <div
          key={item.id}
          className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
              {item.kind === "file" ? (
                <FileText className="h-4 w-4 shrink-0" aria-hidden />
              ) : item.kind === "text" ? (
                <Type className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <Link2 className="h-4 w-4 shrink-0" aria-hidden />
              )}
              <span className="truncate">{item.title}</span>
            </p>
            {item.kind === "text" && item.textBody ? (
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {item.textBody}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-slate-500">
              {item.validationStatus === "approved"
                ? "Aprovada"
                : item.validationStatus === "adjustment_requested"
                  ? "Ajuste solicitado"
                  : item.validationStatus === "invalidated"
                    ? "Não aprovada"
                    : "Aguardando validação"}
            </p>
            {item.validationJustification &&
            (item.validationStatus === "adjustment_requested" ||
              item.validationStatus === "invalidated") ? (
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                {item.validationJustification}
              </p>
            ) : null}
          </div>
          {item.validationStatus === "adjustment_requested" ? (
            <span className="shrink-0 text-xs font-medium text-amber-800">
              Preservada no histórico
            </span>
          ) : onRemoveAttachment ? (
            <button
              type="button"
              onClick={() => void onRemoveAttachment(row, { evidenceId: item.id })}
              disabled={disabled}
              className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-rose-700 hover:text-rose-900 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Remover
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

type EvidenceDetailsProps = {
  row: WorkbenchRow;
  visible: boolean;
  draft: EvidenceDraft;
  pending: boolean;
  fieldErrors?: YesEvidenceFieldErrors;
  disabled?: boolean;
  busy: boolean;
  uploading: boolean;
  onDraftChange: (questionId: string, patch: Partial<EvidenceDraft>) => void;
  onAttachmentChange?: (
    questionId: string,
    clientId: string,
    patch: { title?: string; description?: string },
  ) => void;
  onKindChange: (row: WorkbenchRow, kind: "file" | "link" | "text") => void | Promise<void>;
  onFileSelected: (row: WorkbenchRow, files: File | File[]) => void;
  onRemoveAttachment?: (
    row: WorkbenchRow,
    attachment?: { evidenceId?: string; pendingUploadId?: string; clientId?: string },
  ) => void | Promise<void>;
  onSaveResponse?: (row: WorkbenchRow) => Promise<boolean>;
};

export function EvidenceDetails({
  row,
  visible,
  draft,
  pending,
  fieldErrors,
  disabled,
  busy,
  uploading,
  onDraftChange,
  onAttachmentChange,
  onKindChange,
  onFileSelected,
  onRemoveAttachment,
  onSaveResponse,
}: EvidenceDetailsProps) {
  if (!visible) return null;

  const removable = Boolean(onRemoveAttachment && canRemoveAttachment(row, draft));
  const persistedEvidences = resolvePersistedEvidences(row);
  const evidenceStatus = resolveEvidenceStatus(row);
  const residualFlatFields = hasResidualEvidenceFlatFields(row);
  const pendingAttachments = draft.attachments ?? [];
  const showLegacyEditor =
    draft.kind === "link" ||
    draft.kind === "text" ||
    (pendingAttachments.length === 0 && draft.kind === "file");
  const teamFeedback = validationFeedbackText(row);
  const feedbackTone =
    evidenceStatus === "insufficient" ? formSurface.messageError : formSurface.messageWarning;
  const feedbackHeading =
    evidenceStatus === "insufficient" ? "Justificativa da decisão" : "O que a equipe pediu";
  const operationalHint = evidenceHint(row);

  return (
    <div
      className="mt-5 space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4"
      data-evidence-status={evidenceStatus}
      data-evidence-count={persistedEvidences.length}
      data-evidence-residual-fields={residualFlatFields ? "true" : "false"}
    >
      {operationalHint ? <StatusMessage hint={operationalHint} /> : null}

      {teamFeedback ? (
        <div className={feedbackTone} role="status">
          <p className="text-micro font-semibold uppercase tracking-wider opacity-80">
            {feedbackHeading}
          </p>
          <p className="mt-1 text-sm leading-relaxed">{teamFeedback}</p>
        </div>
      ) : null}

      <div>
        <p className="text-sm font-medium text-slate-800">
          <Paperclip className="mr-1.5 inline h-4 w-4 -translate-y-px text-slate-400" aria-hidden />
          Evidência
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {resolveEvidenceSectionDescription(row, disabled)}
        </p>
      </div>

      {(draft.storagePath || draft.externalLink.trim() || draft.textBody.trim()) &&
      (pending || !row.evidenceId) ? (
        <p
          className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm leading-snug text-brand-900"
          role="status"
        >
          {perguntaLabels.evidenceRegisterHint}
        </p>
      ) : null}

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Modalidade da comprovação
        </p>
        {fieldErrors?.attachment ? (
          <p className="text-sm text-rose-600" role="alert">
            {fieldErrors.attachment}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void onKindChange(row, "text")}
            disabled={Boolean(disabled || busy || uploading)}
            className={`${formSurface.secondaryButtonSm} ${
              draft.kind === "text" ? "border-brand-300 bg-brand-50 text-brand-800" : ""
            }`}
          >
            <Type className="h-4 w-4 text-slate-500" aria-hidden />
            Comprovação textual
          </button>
          <label
            className={`${formSurface.secondaryButtonSm} ${
              disabled || busy || uploading ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            }`}
          >
            <Upload className="h-4 w-4 text-slate-500" aria-hidden />
            <span>{uploading ? "Enviando…" : "Enviar arquivo"}</span>
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={Boolean(disabled || busy || uploading)}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length > 0) onFileSelected(row, files);
                event.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => void onKindChange(row, "link")}
            disabled={Boolean(disabled || busy || uploading)}
            className={`${formSurface.secondaryButtonSm} ${
              draft.kind === "link" ? "border-brand-300 bg-brand-50 text-brand-800" : ""
            }`}
          >
            <Link2 className="h-4 w-4 text-slate-500" aria-hidden />
            Informar link
          </button>
        </div>

        <PersistedEvidenceList
          row={row}
          evidences={persistedEvidences}
          disabled={Boolean(disabled || busy || uploading)}
          onRemoveAttachment={onRemoveAttachment}
        />

        {pendingAttachments.length > 0 ? (
          <div className="space-y-3" aria-label="Novas evidências">
            {pendingAttachments.map((item, index) => (
              <div key={item.clientId} className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-brand-900">
                    <FileText className="h-4 w-4 shrink-0" aria-hidden />
                    Nova evidência {index + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => void onRemoveAttachment?.(row, {
                      pendingUploadId: item.pendingUploadId ?? undefined,
                      clientId: item.clientId,
                    })}
                    disabled={Boolean(disabled || busy || uploading)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 hover:text-rose-900 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Remover
                  </button>
                </div>
                <div className={formSurface.fieldGroup}>
                  <label htmlFor={`ev-title-${row.questionId}-${item.clientId}`} className={formSurface.label}>
                    Título <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id={`ev-title-${row.questionId}-${item.clientId}`}
                    value={item.title}
                    onChange={(event) => onAttachmentChange?.(row.questionId, item.clientId, { title: event.target.value })}
                    disabled={Boolean(disabled || busy)}
                    maxLength={500}
                    className={formSurface.input}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {showLegacyEditor && draft.kind === "file" && draft.storagePath ? (
          <div className="flex flex-col gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-xs leading-snug text-emerald-900">
              <span className="font-medium">Arquivo enviado</span>
            </p>
            {removable ? (
              <button
                type="button"
                onClick={() => void onRemoveAttachment?.(row)}
                disabled={Boolean(disabled || busy || uploading)}
                className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-rose-700 hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Remover
              </button>
            ) : null}
          </div>
        ) : null}

        {showLegacyEditor && draft.kind === "link" ? (
          <div className={formSurface.fieldGroup}>
            <label htmlFor={`ev-link-${row.questionId}`} className={formSurface.label}>
              URL <span className="text-rose-600">*</span>
            </label>
            <input
              id={`ev-link-${row.questionId}`}
              type="url"
              value={draft.externalLink}
              onChange={(event) => onDraftChange(row.questionId, { externalLink: event.target.value })}
              disabled={Boolean(disabled || busy)}
              placeholder="https://..."
              className={`${formSurface.input} ${
                fieldErrors?.attachment ? "border-rose-400 ring-1 ring-rose-200" : ""
              }`}
              aria-invalid={fieldErrors?.attachment ? true : undefined}
            />
            {removable ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void onRemoveAttachment?.(row)}
                  disabled={Boolean(disabled || busy || uploading)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Remover link
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {showLegacyEditor && draft.kind === "text" ? (
          <div className={formSurface.fieldGroup}>
            <label htmlFor={`ev-text-${row.questionId}`} className={formSurface.label}>
              Texto da comprovação <span className="text-rose-600">*</span>
            </label>
            <textarea
              id={`ev-text-${row.questionId}`}
              value={draft.textBody}
              onChange={(event) =>
                onDraftChange(row.questionId, { textBody: event.target.value })
              }
              disabled={Boolean(disabled || busy)}
              rows={6}
              maxLength={20000}
              placeholder="Descreva a comprovação textual deste critério…"
              className={`${formSurface.inputTextarea} ${
                fieldErrors?.attachment ? "border-rose-400 ring-1 ring-rose-200" : ""
              }`}
              aria-invalid={fieldErrors?.attachment ? true : undefined}
            />
            {removable ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void onRemoveAttachment?.(row)}
                  disabled={Boolean(disabled || busy || uploading)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Remover texto
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {showLegacyEditor ? <div className="space-y-3">
        <div className={formSurface.fieldGroup}>
          <label htmlFor={`ev-title-${row.questionId}`} className={formSurface.label}>
            Título da evidência <span className="text-rose-600">*</span>
          </label>
          <input
            id={`ev-title-${row.questionId}`}
            type="text"
            value={draft.title}
            onChange={(event) => onDraftChange(row.questionId, { title: event.target.value })}
            disabled={Boolean(disabled || busy)}
            maxLength={500}
            placeholder="Ex.: Política de integridade aprovada – 2026"
            className={`${formSurface.input} ${
              fieldErrors?.title ? "border-rose-400 ring-1 ring-rose-200" : ""
            }`}
            aria-invalid={fieldErrors?.title ? true : undefined}
            aria-describedby={fieldErrors?.title ? `ev-title-error-${row.questionId}` : undefined}
          />
          {fieldErrors?.title ? (
            <p id={`ev-title-error-${row.questionId}`} className="text-sm text-rose-600" role="alert">
              {fieldErrors.title}
            </p>
          ) : null}
        </div>
        <div className={formSurface.fieldGroup}>
          <label htmlFor={`ev-desc-${row.questionId}`} className={formSurface.label}>
            Descrição (opcional)
          </label>
          <textarea
            id={`ev-desc-${row.questionId}`}
            value={draft.description}
            onChange={(event) => onDraftChange(row.questionId, { description: event.target.value })}
            disabled={Boolean(disabled || busy)}
            rows={2}
            maxLength={4000}
            placeholder="Observações, página relevante, período…"
            className={formSurface.inputTextarea}
          />
        </div>
      </div> : null}

      {onSaveResponse ? (
        <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Salve a resposta com ou sem evidência. A pontuação oficial deste critério
            será definida no cálculo final após a validação do diagnóstico.
          </p>
          <button
            type="button"
            onClick={() => void onSaveResponse(row)}
            disabled={Boolean(disabled || busy || uploading)}
            className={formSurface.primaryButtonSm}
          >
            {busy ? "Salvando resposta…" : "Salvar resposta"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
