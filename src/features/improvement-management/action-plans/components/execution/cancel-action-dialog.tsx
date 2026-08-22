"use client";

import { typography } from "@/shared/layout/design-system";

import { useState } from "react";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { cancelRespondentActionPlan } from "@/features/improvement-management/action-plans/client";
import { formSurface } from "@/shared/layout/form-surface";
import { LoadingButton } from "@/shared/ui/components/loading";
import { describeError, notify } from "@/infrastructure/notifications/notify";

type Props = {
  plan: ActionPlanAction;
  recommendationId: string;
  open: boolean;
  onClose: () => void;
  onCancelled: () => Promise<void>;
};

export function CancelActionDialog({
  plan,
  recommendationId,
  open,
  onClose,
  onCancelled,
}: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await cancelRespondentActionPlan({
        intent: "cancel",
        planId: plan.id,
        recommendationId,
        expectedRevision: plan.revision,
        observations: String(form.get("observations") ?? ""),
      });
      notify.success("Ação cancelada. O histórico foi preservado.");
      await onCancelled();
      onClose();
    } catch (caught) {
      setError(describeError(caught, "Falha ao cancelar a ação."));
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-action-title"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg space-y-4 rounded-xl bg-white p-5 shadow-xl"
      >
        <div>
          <h3 id="cancel-action-title" className={typography.subsectionTitle}>
            Cancelar ação?
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Esta ação deixará de compor o progresso normal do plano. O histórico e a
            auditoria serão preservados.
          </p>
        </div>

        {error ? <p role="alert" className={formSurface.messageError}>{error}</p> : null}

        <label className={`${formSurface.fieldGroup} block`}>
          <span className={formSurface.label}>Motivo do cancelamento</span>
          <textarea
            name="observations"
            rows={3}
            className={formSurface.inputTextarea}
            placeholder="Explique por que a ação foi cancelada."
            required
            minLength={1}
            maxLength={4000}
          />
        </label>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className={formSurface.secondaryButtonSm}
            disabled={pending}
            onClick={onClose}
          >
            Voltar
          </button>
          <LoadingButton
            type="submit"
            pending={pending}
            pendingLabel="Cancelando..."
            className={formSurface.dangerButton}
          >
            Confirmar cancelamento
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
