import { LoadingButton } from "@/shared/ui/components/loading";
import { formSurface } from "@/shared/layout/form-surface";
import type { QueueNotApplicable } from "@/features/validation/queue-model";
import { VALIDATION_ANALYSIS_CONFIRMED_LABEL } from "../validation-analysis-autosave";
import type {
  NotApplicableAction,
  NotApplicableCardController,
} from "./use-not-applicable-card-controller";
import { ValidationAutosaveIndicator } from "./validation-autosave-indicator";

const ACTION_LABEL: Record<NotApplicableAction, string> = {
  approve: "Aceitar “Não se aplica”",
  reject: "Rejeitar “Não se aplica”",
};

function RevertDecisionPanel({
  controller,
  disabled,
}: {
  controller: NotApplicableCardController;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 sm:p-4">
      <p className="text-sm text-slate-600">
        A revisão remove a classificação administrativa e devolve o critério à
        fila de evidências, sem alterar a resposta original.
      </p>
      <label className={formSurface.fieldGroup}>
        <span className={formSurface.label}>
          Justificativa da revisão{" "}
          <span className="text-rose-600" aria-hidden>
            *
          </span>
        </span>
        <textarea
          value={controller.revertJustification}
          onChange={(event) =>
            controller.setRevertJustification(event.target.value)
          }
          rows={3}
          maxLength={2000}
          required
          disabled={disabled || controller.submitting}
          className={formSurface.inputTextarea}
        />
      </label>
      {controller.error ? (
        <p role="alert" className={formSurface.messageError}>
          {controller.error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <LoadingButton
          type="button"
          pending={controller.submitting}
          pendingLabel="Registrando…"
          disabled={
            disabled ||
            controller.submitting ||
            !controller.revertJustification.trim()
          }
          onClick={() => void controller.confirmRevert()}
          className={formSurface.primaryButtonSm}
        >
          Confirmar revisão
        </LoadingButton>
        <button
          type="button"
          disabled={controller.submitting || disabled}
          onClick={controller.cancelRevert}
          className={formSurface.ghostButton}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function VerdictForm({
  item,
  controller,
  disabled,
}: {
  item: QueueNotApplicable;
  controller: NotApplicableCardController;
  disabled: boolean;
}) {
  const action = controller.action;
  if (!action) return null;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 sm:p-4">
      {action === "reject" ? (
        <label
          htmlFor={`na-reject-${item.id}`}
          className={formSurface.fieldGroup}
        >
          <span className={formSurface.label}>
            Motivo da rejeição{" "}
            <span className="text-rose-600" aria-hidden>
              *
            </span>
          </span>
          <textarea
            id={`na-reject-${item.id}`}
            value={controller.rejectionReason}
            onChange={(event) =>
              controller.setRejectionReason(event.target.value)
            }
            rows={3}
            maxLength={2000}
            required
            disabled={disabled || controller.submitting}
            className={formSurface.inputTextarea}
            placeholder="Explique por que “não se aplica” não foi aceito…"
          />
        </label>
      ) : (
        <p className="text-sm text-slate-600">
          Confirme o aceite de “Não se aplica” para este critério.
        </p>
      )}

      <ValidationAutosaveIndicator
        state={controller.autosaveState}
        onRetry={controller.retryAutosave}
        confirmed={controller.confirmedFlash}
        confirmedLabel={VALIDATION_ANALYSIS_CONFIRMED_LABEL}
      />

      {controller.error ? (
        <p role="alert" className={formSurface.messageError}>
          {controller.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <LoadingButton
          type="button"
          pending={controller.submitting}
          pendingLabel="Registrando…"
          disabled={!controller.canSubmit}
          onClick={() => void controller.confirmVerdict()}
          className={formSurface.primaryButtonSm}
        >
          Confirmar {ACTION_LABEL[action]}
        </LoadingButton>
        <button
          type="button"
          disabled={controller.submitting || disabled}
          onClick={controller.cancelAction}
          className={formSurface.ghostButton}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function NotApplicableDecisionPanel({
  item,
  controller,
  disabled,
  canRevertAdminDecision,
}: {
  item: QueueNotApplicable;
  controller: NotApplicableCardController;
  disabled: boolean;
  canRevertAdminDecision: boolean;
}) {
  if (
    controller.isAdminDecision &&
    canRevertAdminDecision &&
    !controller.reverting &&
    !controller.changingDecision
  ) {
    return (
      <button
        type="button"
        disabled={disabled || controller.submitting}
        onClick={controller.startRevert}
        className={formSurface.secondaryButtonSm}
      >
        Revisar decisão
      </button>
    );
  }

  if (controller.isAdminDecision && controller.reverting) {
    return <RevertDecisionPanel controller={controller} disabled={disabled} />;
  }

  if (
    !controller.isAdminDecision &&
    controller.decided &&
    !controller.changingDecision &&
    !controller.action
  ) {
    return (
      <button
        type="button"
        disabled={disabled || controller.submitting}
        onClick={controller.startDecisionChange}
        className={formSurface.secondaryButtonSm}
      >
        Alterar decisão
      </button>
    );
  }

  if (!controller.showActions) return null;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-slate-800">Validação</h4>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Aceite ou rejeite a marcação “Não se aplica” deste critério.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(ACTION_LABEL) as NotApplicableAction[]).map((action) => (
          <button
            key={action}
            type="button"
            disabled={disabled || controller.submitting}
            onClick={() => controller.selectAction(action)}
            className={`${
              controller.action === action
                ? `${formSurface.secondaryButtonSm} border-brand-400 bg-brand-50 text-brand-900`
                : formSurface.secondaryButtonSm
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {ACTION_LABEL[action]}
          </button>
        ))}
      </div>
      <VerdictForm item={item} controller={controller} disabled={disabled} />
    </div>
  );
}
