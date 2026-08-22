"use client";

import { typography } from "@/shared/layout/design-system";

import { useState } from "react";
import { Upload } from "lucide-react";
import type { LibraryTransition } from "@/features/library/client";
import type { LibraryItemStatus } from "@/features/library/types";
import { formSurface } from "@/shared/layout/form-surface";
import { LoadingButton } from "@/shared/ui/components/loading";

type SupportedTransition = "publish";

export type TransitionOption = {
  action: LibraryTransition;
  label: string;
  icon: React.ReactNode;
  requiresJustification: boolean;
  confirmTitle: string;
  confirmText: string;
};

const BASE_OPTIONS: Record<SupportedTransition, TransitionOption> = {
  publish: {
    action: "publish",
    label: "Publicar",
    icon: <Upload className="h-3.5 w-3.5" aria-hidden />,
    requiresJustification: false,
    confirmTitle: "Publicar rascunho",
    confirmText:
      "O item está em rascunho. Ao confirmar, ele passará para o status Publicado e poderá ser usado na configuração de perguntas dos formulários.",
  },
};

const ALLOWED_BY_STATUS: Record<LibraryItemStatus, SupportedTransition[]> = {
  draft: ["publish"],
  in_review: ["publish"],
  published: [],
  deprecated: [],
  archived: [],
};

type Props = {
  status: LibraryItemStatus;
  disabled?: boolean;
  onRun: (
    action: LibraryTransition,
    payload: { justification?: string | null },
  ) => Promise<void>;
};

export function LifecycleMenu({ status, disabled, onRun }: Props) {
  const [pending, setPending] = useState<TransitionOption | null>(null);
  const [justification, setJustification] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = ALLOWED_BY_STATUS[status] ?? [];
  if (options.length === 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  async function confirm() {
    if (!pending) return;
    setRunning(true);
    setError(null);
    try {
      const normalized = justification.trim();
      if (pending.requiresJustification && normalized.length < 5) {
        setError("Justificativa deve ter pelo menos 5 caracteres.");
        setRunning(false);
        return;
      }
      await onRun(pending.action, {
        justification: normalized.length > 0 ? normalized : null,
      });
      setPending(null);
      setJustification("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao aplicar transição.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1">
        {options.map((action) => {
          const option = BASE_OPTIONS[action];
          return (
            <button
              key={action}
              type="button"
              disabled={disabled || running}
              title={option.label}
              aria-label={option.label}
              onClick={() => {
                setPending(option);
                setJustification("");
                setError(null);
              }}
              className={`${formSurface.secondaryButtonSm} gap-1.5 px-2.5`}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      {pending ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-popover">
            <h3 className={typography.cardTitle}>
              {pending.confirmTitle}
            </h3>
            <p className="mt-2 text-sm text-slate-600">{pending.confirmText}</p>

            <label className="mt-4 block text-xs font-medium text-slate-600">
              Justificativa
              {pending.requiresJustification ? (
                <span className="ml-1 text-rose-500">*</span>
              ) : null}
            </label>
            <textarea
              rows={3}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              className={`mt-1 w-full ${formSurface.inputTextarea}`}
              placeholder="Motivo da ação (visível no histórico quando exigido)."
            />

            {error ? (
              <p role="alert" aria-live="assertive" className="mt-2 text-sm text-rose-700">{error}</p>
            ) : null}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                  setJustification("");
                }}
                disabled={running}
                className={`${formSurface.secondaryButton} disabled:opacity-50`}
              >
                Cancelar
              </button>
              <LoadingButton
                type="button"
                pending={running}
                pendingLabel="Aplicando…"
                onClick={() => void confirm()}
                className={`${formSurface.primaryButton} disabled:opacity-50`}
              >
                Confirmar
              </LoadingButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
