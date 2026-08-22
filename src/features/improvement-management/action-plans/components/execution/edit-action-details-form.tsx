"use client";

import { typography } from "@/shared/layout/design-system";

import { useState } from "react";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import {
  editRespondentActionDetails,
  type ActionPlanResponsibleMember,
} from "@/features/improvement-management/action-plans/client";
import { formSurface } from "@/shared/layout/form-surface";
import { LoadingButton } from "@/shared/ui/components/loading";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import { formatLocalDate } from "@/shared/datetime/business-date";

type Props = {
  plan: ActionPlanAction;
  recommendationId: string;
  responsibleMembers: ActionPlanResponsibleMember[];
  responsibleMembersLoading?: boolean;
  responsibleMembersError?: string | null;
  onRetryResponsibleMembers?: () => void;
  onSaved: () => Promise<void>;
  onCancel: () => void;
};

function responsibleOptionLabel(member: ActionPlanResponsibleMember): string {
  if (!member.email || member.email === member.name) return member.name;
  return `${member.name} — ${member.email}`;
}

export function EditActionDetailsForm({
  plan,
  recommendationId,
  responsibleMembers,
  responsibleMembersLoading = false,
  responsibleMembersError = null,
  onRetryResponsibleMembers,
  onSaved,
  onCancel,
}: Props) {
  const initialResponsible =
    plan.responsibleUserId &&
    responsibleMembers.some((member) => member.userId === plan.responsibleUserId)
      ? plan.responsibleUserId
      : "";
  const [pending, setPending] = useState(false);
  const [startDate, setStartDate] = useState(plan.startDate);
  const [responsibleUserId, setResponsibleUserId] = useState(initialResponsible);
  const [error, setError] = useState<string | null>(null);

  const responsibleUnavailable =
    responsibleMembersLoading || Boolean(responsibleMembersError) || responsibleMembers.length === 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const selectedResponsibleUserId = String(form.get("responsibleUserId") ?? "").trim();
    if (!selectedResponsibleUserId) {
      setError("Selecione o respondente responsável pela ação.");
      return;
    }

    setPending(true);
    try {
      await editRespondentActionDetails({
        intent: "edit_details",
        planId: plan.id,
        recommendationId,
        expectedRevision: plan.revision,
        actionText: String(form.get("actionText") ?? ""),
        startDate: String(form.get("startDate") ?? ""),
        responsibleSector: String(form.get("responsibleSector") ?? ""),
        responsibleUserId: selectedResponsibleUserId,
      });
      notify.success("Dados da ação atualizados.");
      await onSaved();
    } catch (caught) {
      setError(describeError(caught, "Falha ao editar os dados da ação."));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className={typography.subsectionTitle}>Editar dados</h3>
        <button type="button" className={formSurface.ghostButton} onClick={onCancel}>
          cancelar
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-4 shadow-sm sm:p-5">
        {error ? <p role="alert" className={formSurface.messageError}>{error}</p> : null}
        {responsibleMembersError ? (
          <div role="alert" className={`${formSurface.messageError} flex flex-wrap items-center justify-between gap-2`}>
            <span>{responsibleMembersError}</span>
            {onRetryResponsibleMembers ? (
              <button
                type="button"
                className={formSurface.secondaryButtonSm}
                onClick={onRetryResponsibleMembers}
                disabled={responsibleMembersLoading}
              >
                Tentar novamente
              </button>
            ) : null}
          </div>
        ) : null}

        <label className={formSurface.fieldGroup}>
          <span className={formSurface.label}>Ação ou compromisso</span>
          <textarea
            name="actionText"
            rows={3}
            className={formSurface.inputTextarea}
            defaultValue={plan.actionText}
            required
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={`${formSurface.fieldGroup} block`}>
            <span className={formSurface.label}>Início</span>
            <input
              name="startDate"
              type="date"
              className={formSurface.input}
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              max={plan.dueDate}
              required
            />
          </label>
          <div className={formSurface.fieldGroup}>
            <span className={formSurface.label}>Final vigente</span>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800">
              {formatLocalDate(plan.dueDate)}
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Para modificar este final, use a opção <strong>Solicitar final</strong>. A mudança só entra em vigor após decisão da supervisão.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={formSurface.fieldGroup}>
            <span className={formSurface.label}>Área responsável</span>
            <input
              name="responsibleSector"
              className={formSurface.input}
              defaultValue={plan.responsibleSector}
              required
            />
          </label>
          <label className={formSurface.fieldGroup}>
            <span className={formSurface.label}>Respondente responsável</span>
            <select
              name="responsibleUserId"
              className={formSurface.inputSelect}
              value={responsibleUserId}
              onChange={(event) => setResponsibleUserId(event.target.value)}
              disabled={responsibleUnavailable}
              required
            >
              <option value="">Selecione um respondente</option>
              {responsibleMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {responsibleOptionLabel(member)}
                </option>
              ))}
            </select>
          </label>
        </div>


        <LoadingButton
          type="submit"
          pending={pending}
          pendingLabel="Salvando..."
          disabled={responsibleUnavailable}
          className={`${formSurface.primaryButton} w-full justify-center sm:w-auto sm:min-w-40`}
        >
          Salvar dados
        </LoadingButton>
      </form>
    </div>
  );
}
