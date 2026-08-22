"use client";

import { typography } from "@/shared/layout/design-system";

import { useMemo, useState } from "react";
import type {
  ValidationBatchAction,
  ValidationBatchOption,
} from "../batch-actions";
import { LoadingButton } from "@/shared/ui/components/loading";
import { formSurface } from "@/shared/layout/form-surface";

export function ValidationBatchActions({
  selectedCount,
  options,
  pending,
  error,
  onApply,
  onClear,
}: {
  selectedCount: number;
  options: ValidationBatchOption[];
  pending: boolean;
  error: string | null;
  onApply: (action: ValidationBatchAction, justification: string) => Promise<boolean>;
  onClear: () => void;
}) {
  const [action, setAction] = useState<ValidationBatchAction | null>(null);
  const [justification, setJustification] = useState("");
  const selectedOption = useMemo(
    () => options.find((option) => option.action === action) ?? null,
    [action, options],
  );

  if (action && !options.some((option) => option.action === action)) {
    setAction(null);
    setJustification("");
  }

  if (selectedCount === 0) return null;

  const canSubmit =
    selectedOption !== null &&
    (!selectedOption.requiresJustification || justification.trim().length > 0) &&
    !pending;

  return (
    <section
      className="space-y-4 rounded-xl border border-brand-200 bg-brand-50/60 p-4"
      aria-label="Ações em lote"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={typography.cardTitle}>
            {selectedCount} critério(s) selecionado(s)
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Somente decisões compatíveis com todos os critérios selecionados são exibidas.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={onClear}
          className={formSurface.secondaryButtonSm}
        >
          Limpar seleção
        </button>
      </div>

      {options.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          A seleção mistura tipos de decisão incompatíveis. Selecione apenas evidências,
          apenas respostas “Não se aplica” ou apenas critérios elegíveis à classificação administrativa.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              key={option.action}
              type="button"
              aria-pressed={action === option.action}
              disabled={pending}
              onClick={() => {
                setAction(option.action);
                setJustification("");
              }}
              className={
                action === option.action
                  ? formSurface.primaryButtonSm
                  : formSurface.secondaryButtonSm
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {selectedOption ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
          <label className={formSurface.fieldGroup}>
            <span className={formSurface.label}>
              {selectedOption.justificationLabel}
              {selectedOption.requiresJustification ? " *" : ""}
            </span>
            <textarea
              value={justification}
              disabled={pending}
              onChange={(event) => setJustification(event.target.value)}
              maxLength={2000}
              rows={3}
              className={formSurface.inputTextarea}
              placeholder={
                selectedOption.requiresJustification
                  ? "Informe uma justificativa clara para todos os itens selecionados."
                  : "Opcional"
              }
            />
          </label>
          {error ? (
            <p role="alert" className={formSurface.messageError}>
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <LoadingButton
              type="button"
              pending={pending}
              pendingLabel="Aplicando decisão…"
              disabled={!canSubmit}
              onClick={() => {
                if (!action) return;
                void onApply(action, justification).then((applied) => {
                  if (!applied) return;
                  setAction(null);
                  setJustification("");
                });
              }}
              className={formSurface.primaryButtonSm}
            >
              Aplicar aos selecionados
            </LoadingButton>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setAction(null);
                setJustification("");
              }}
              className={formSurface.secondaryButtonSm}
            >
              Cancelar ação
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
