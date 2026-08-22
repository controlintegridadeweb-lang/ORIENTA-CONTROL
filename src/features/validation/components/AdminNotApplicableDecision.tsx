"use client";

import { useState } from "react";
import { answerLabel } from "../queue-model";
import { LoadingButton } from "@/shared/ui/components/loading";
import { notify } from "@/infrastructure/notifications/notify";
import { formSurface } from "@/shared/layout/form-surface";

export type AdminNotApplicableContext = {
  responseId: string;
  questionPrompt: string;
  answer: "yes" | "no";
  documents: ReadonlyArray<{
    id: string;
    fileName?: string | null;
    externalLink?: string | null;
  }>;
};

export function AdminNotApplicableDecision({
  context,
  onSubmit,
  disabled = false,
  triggerLabel = "Marcar como “Não se aplica”",
  onOpen,
}: {
  context: AdminNotApplicableContext;
  onSubmit: (responseId: string, justification: string) => Promise<void>;
  disabled?: boolean;
  triggerLabel?: string;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setJustification("");
    setError(null);
  }

  async function confirm() {
    const value = justification.trim();
    if (!value) {
      setError("Informe a justificativa da decisão.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(context.responseId, value);
      notify.success("Critério classificado como “Não se aplica”.");
      close();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível registrar a classificação.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
        className={`${formSurface.secondaryButtonSm} w-full sm:w-auto`}
      >
        {triggerLabel}
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 sm:p-4">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-slate-800">
          Confirmar “Não se aplica”
        </h4>
        <p className="text-sm leading-relaxed text-slate-800">
          {context.questionPrompt}
        </p>
        <p className="text-xs leading-relaxed text-slate-500">
          Critério elegível a classificação administrativa “Não se aplica”. A
          resposta “{answerLabel(context.answer)}” permanece registrada. A
          resposta original e as comprovações serão preservadas. O critério sai
          das pendências e deixa de entrar no denominador do FAMI.
        </p>
      </div>
      <dl className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
        <div>
          <dt className={formSurface.label}>Resposta original</dt>
          <dd>{answerLabel(context.answer)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className={formSurface.label}>Comprovações apresentadas</dt>
          <dd>
            {context.documents.length === 0 ? (
              "Nenhuma comprovação apresentada"
            ) : (
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {context.documents.map((document) => (
                  <li key={document.id}>
                    {document.fileName?.trim() ||
                      document.externalLink?.trim() ||
                      "Evidência"}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
      <label className={formSurface.fieldGroup}>
        <span className={formSurface.label}>
          Justificativa da decisão <span className="text-rose-600">*</span>
        </span>
        <textarea
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
          rows={3}
          maxLength={2000}
          required
          disabled={disabled || submitting}
          className={formSurface.inputTextarea}
          placeholder="Explique por que o critério não se aplica a este órgão…"
        />
      </label>
      {error ? (
        <p role="alert" className={formSurface.messageError}>
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <LoadingButton
          type="button"
          pending={submitting}
          pendingLabel="Registrando…"
          disabled={disabled || submitting || !justification.trim()}
          onClick={() => void confirm()}
          className={formSurface.primaryButtonSm}
        >
          Confirmar como não se aplica
        </LoadingButton>
        <button
          type="button"
          disabled={submitting || disabled}
          onClick={close}
          className={formSurface.ghostButton}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
