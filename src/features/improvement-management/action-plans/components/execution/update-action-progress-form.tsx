"use client";

import { typography } from "@/shared/layout/design-system";

import { useId, useState } from "react";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { updateRespondentActionProgress } from "@/features/improvement-management/action-plans/client";
import {
  PlanStatusBadge,
  PLAN_STATUS_LABELS,
} from "@/features/improvement-management/action-plans/components/shared/plan-status-badge";
import { deriveActionStatus } from "@/features/improvement-management/action-plans/plan-progress";
import { ActionPlanEvidenceManager } from "@/features/improvement-management/recommendations/components/hub/action-plan-evidence-manager";
import { formSurface } from "@/shared/layout/form-surface";
import { LoadingButton } from "@/shared/ui/components/loading";
import { describeError, notify } from "@/infrastructure/notifications/notify";

type Props = {
  plan: ActionPlanAction;
  recommendationId: string;
  onSaved: () => Promise<void>;
  onCancel: () => void;
};

export function UpdateActionProgressForm({
  plan,
  recommendationId,
  onSaved,
  onCancel,
}: Props) {
  const [pending, setPending] = useState(false);
  const [progressPercentage, setProgressPercentage] = useState(plan.progressPercentage);
  const [error, setError] = useState<string | null>(null);
  const progressLabelId = useId();
  const committedProgress = plan.progressPercentage;
  const derivedStatus = deriveActionStatus(progressPercentage, false);
  const progressLocked = committedProgress >= 100;

  function applyProgress(next: number) {
    setProgressPercentage(Math.max(committedProgress, Math.min(100, next)));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await updateRespondentActionProgress({
        intent: "update_progress",
        planId: plan.id,
        recommendationId,
        expectedRevision: plan.revision,
        progressPercentage: Math.max(committedProgress, progressPercentage),
        progressUpdateDescription: String(form.get("progressUpdateDescription") ?? ""),
      });
      notify.success("Andamento atualizado.");
      await onSaved();
    } catch (caught) {
      setError(describeError(caught, "Falha ao atualizar o andamento."));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className={typography.subsectionTitle}>Atualizar andamento</h3>
        <button type="button" className={formSurface.ghostButton} onClick={onCancel}>
          cancelar
        </button>
      </div>

      <p className="text-sm text-slate-600 line-clamp-2">{plan.actionText}</p>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-4 shadow-sm sm:p-5">
        {error ? <p role="alert" className={formSurface.messageError}>{error}</p> : null}

        <div className={formSurface.fieldGroup}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={formSurface.label} id={progressLabelId}>
              Progresso da ação
            </span>
            <div className="flex items-center gap-2">
              <PlanStatusBadge status={derivedStatus} />
              <span className="min-w-10 text-right text-sm font-semibold tabular-nums text-slate-900">
                {progressPercentage}%
              </span>
            </div>
          </div>
          <div
            className={`relative flex h-11 w-full items-center rounded-lg ${
              progressLocked
                ? ""
                : "focus-within:ring-2 focus-within:ring-brand/30 focus-within:ring-offset-2"
            }`}
          >
            <div className={formSurface.formWorkspace.sectionProgressTrack} aria-hidden>
              <div
                className={formSurface.formWorkspace.sectionProgressFill}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 size-4 rounded-full border-2 border-white bg-brand shadow-sm"
              style={{
                left: `calc(${progressPercentage} / 100 * (100% - 1rem))`,
                transform: "translateY(-50%)",
              }}
            />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              disabled={progressLocked}
              className="absolute inset-0 h-11 w-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-not-allowed"
              value={progressPercentage}
              aria-labelledby={progressLabelId}
              aria-valuemin={committedProgress}
              aria-valuemax={100}
              aria-valuetext={`${progressPercentage}% · ${PLAN_STATUS_LABELS[derivedStatus]}`}
              onChange={(event) => applyProgress(Number(event.target.value))}
            />
          </div>
          <p className={formSurface.fieldHint}>
            {progressLocked
              ? "Esta ação já está concluída. O percentual permanece em 100%."
              : committedProgress > 0
                ? `O andamento só avança. O percentual atual (${committedProgress}%) é o mínimo desta atualização.`
                : "Depois de salvo, o percentual informado não poderá ser reduzido."}
          </p>
        </div>

        <label className={formSurface.fieldGroup}>
          <span className={formSurface.label}>O que foi realizado nesta atualização?</span>
          <textarea
            name="progressUpdateDescription"
            rows={3}
            className={formSurface.inputTextarea}
            placeholder="Ex.: Capacitação concluída e implantação iniciada."
            required
            minLength={5}
            maxLength={4000}
          />
        </label>

        <ActionPlanEvidenceManager embedded plan={plan} onChanged={onSaved} />

        <LoadingButton
          type="submit"
          pending={pending}
          pendingLabel="Salvando..."
          className={`${formSurface.primaryButton} w-full justify-center sm:w-auto sm:min-w-40`}
        >
          Salvar atualização
        </LoadingButton>
      </form>
    </div>
  );
}
