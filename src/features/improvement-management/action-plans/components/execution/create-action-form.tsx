"use client";

import { typography } from "@/shared/layout/design-system";

import { useState } from "react";
import {
  addActionPlanDocumentFile,
  addActionPlanDocumentLink,
  createRespondentActionPlan,
  type ActionPlanResponsibleMember,
} from "@/features/improvement-management/action-plans/client";
import { formSurface } from "@/shared/layout/form-surface";
import { LoadingButton } from "@/shared/ui/components/loading";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import { businessDateAfter, businessToday } from "@/shared/datetime/business-date";
import { getAxisTheme } from "@/shared/theme/axis-theme";
import {
  ActionPlanDocumentsDraft,
  type ActionPlanDraftDocument,
} from "@/features/improvement-management/recommendations/components/hub/action-plan-documents-draft";

type Props = {
  recommendationId: string;
  recommendationText: string;
  axisName: string;
  responsibleMembers: ActionPlanResponsibleMember[];
  responsibleMembersLoading?: boolean;
  responsibleMembersError?: string | null;
  onRetryResponsibleMembers?: () => void;
  onCreated: (planId: string) => void | Promise<void>;
  onCancel: () => void;
};

function responsibleOptionLabel(member: ActionPlanResponsibleMember): string {
  if (!member.email || member.email === member.name) return member.name;
  return `${member.name} — ${member.email}`;
}

export function CreateActionForm({
  recommendationId,
  recommendationText,
  axisName,
  responsibleMembers,
  responsibleMembersLoading = false,
  responsibleMembersError = null,
  onRetryResponsibleMembers,
  onCreated,
  onCancel,
}: Props) {
  const theme = getAxisTheme(axisName);
  const [pending, setPending] = useState(false);
  const [startDate, setStartDate] = useState(businessToday());
  const [dueDate, setDueDate] = useState(businessDateAfter(30));
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [draftDocuments, setDraftDocuments] = useState<ActionPlanDraftDocument[]>([]);

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
      const result = await createRespondentActionPlan({
        intent: "create",
        recommendationId,
        actionText: String(form.get("actionText") ?? ""),
        startDate: String(form.get("startDate") ?? ""),
        dueDate: String(form.get("dueDate") ?? ""),
        responsibleSector: String(form.get("responsibleSector") ?? ""),
        responsibleUserId: selectedResponsibleUserId,
      });

      for (const draft of draftDocuments) {
        if (draft.kind === "file") {
          await addActionPlanDocumentFile({
            planId: result.planId,
            expectedRevision: result.revision,
            title: draft.title,
            file: draft.file,
          });
        } else {
          await addActionPlanDocumentLink({
            planId: result.planId,
            expectedRevision: result.revision,
            title: draft.title,
            externalLink: draft.externalLink,
          });
        }
      }

      notify.success(
        draftDocuments.length > 0
          ? "Ação cadastrada com documentos anexados."
          : "Ação cadastrada.",
      );
      await onCreated(result.planId);
    } catch (caught) {
      setError(describeError(caught, "Falha ao cadastrar a ação."));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className={typography.subsectionTitle}>Cadastrar nova ação</h3>
        <button type="button" className={formSurface.ghostButton} onClick={onCancel}>
          cancelar
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-4 shadow-sm sm:p-5">
        {error ? (
          <p role="alert" className={formSurface.messageError}>{error}</p>
        ) : null}
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

        <div className="space-y-2">
          <span className={formSurface.label}>Recomendação de referência</span>
          <div
            className="rounded-lg px-3.5 py-3 text-sm font-medium leading-relaxed text-white"
            style={{ backgroundColor: theme.primary }}
          >
            <p className="whitespace-pre-wrap">{recommendationText}</p>
          </div>
        </div>

        <label className={formSurface.fieldGroup}>
          <span className={formSurface.label}>Ação ou compromisso</span>
          <textarea
            name="actionText"
            rows={3}
            className={formSurface.inputTextarea}
            placeholder="Descreva uma ação concreta e verificável."
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
              onChange={(event) => {
                const nextStart = event.target.value;
                setStartDate(nextStart);
                if (dueDate && dueDate < nextStart) setDueDate(nextStart);
              }}
              required
            />
          </label>
          <label className={`${formSurface.fieldGroup} block`}>
            <span className={formSurface.label}>Final</span>
            <input
              name="dueDate"
              type="date"
              className={formSurface.input}
              value={dueDate}
              min={startDate}
              onChange={(event) => setDueDate(event.target.value)}
              required
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={formSurface.fieldGroup}>
            <span className={formSurface.label}>Área responsável</span>
            <input
              name="responsibleSector"
              className={formSurface.input}
              placeholder="Ex.: TI"
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
              <option value="">
                {responsibleMembersLoading
                  ? "Carregando respondentes…"
                  : responsibleMembers.length === 0
                    ? "Nenhum respondente disponível"
                    : "Selecione um respondente"}
              </option>
              {responsibleMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {responsibleOptionLabel(member)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ActionPlanDocumentsDraft items={draftDocuments} onChange={setDraftDocuments} />

        <LoadingButton
          type="submit"
          pending={pending}
          pendingLabel="Cadastrando..."
          disabled={responsibleUnavailable}
          className={`${formSurface.primaryButton} w-full justify-center sm:w-auto sm:min-w-40`}
        >
          Cadastrar ação
        </LoadingButton>
      </form>
    </div>
  );
}
