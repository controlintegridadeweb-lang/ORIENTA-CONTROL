"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import type { SupervisionNoteEntry } from "@/features/improvement-management/action-plans/types";
import { createSupervisionNote } from "@/features/improvement-management/action-plans/client";
import {
  MONITORING_COMPOSER_TYPE_LABELS,
  MONITORING_COMPOSER_TYPES,
  SUPERVISION_NOTE_META,
} from "@/features/improvement-management/action-plans/supervision-presentation";
import type { SupervisionNoteComposerType } from "@/features/improvement-management/action-plans/schemas";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { LoadingButton } from "@/shared/ui/components/loading";
import { formSurface } from "@/shared/layout/form-surface";
import { notify } from "@/infrastructure/notifications/notify";
import { hasValidExecutionEvidence } from "@/features/improvement-management/action-plans/execution-evidence-policy";

type Props = {
  recommendationId: string;
  plan: ActionPlanAction;
  openRequestActionIds: Set<string>;
  checkingOpenRequests?: boolean;
  openRequestCheckError?: string | null;
  onCreated: (created: SupervisionNoteEntry) => void;
};

export function MonitoringComposer({
  recommendationId,
  plan,
  openRequestActionIds,
  checkingOpenRequests = false,
  openRequestCheckError = null,
  onCreated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [noteType, setNoteType] = useState<SupervisionNoteComposerType>("comment");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const approvalBlockMessage = useMemo(() => {
    if (noteType !== "approval") return null;
    if (plan.status !== "completed") {
      return "Conclua a ação antes de registrar o aceite da execução.";
    }
    if (!hasValidExecutionEvidence(plan.documents)) {
      return "Adicione ao menos uma comprovação válida da revisão atual antes de registrar o aceite.";
    }
    if (checkingOpenRequests) {
      return "Verificando solicitações e pendências abertas antes de liberar o aceite.";
    }
    if (openRequestCheckError) {
      return "Não foi possível verificar as pendências abertas. Tente novamente antes de registrar o aceite.";
    }
    if (openRequestActionIds.has(plan.id)) {
      return "Resolva as solicitações ou pendências abertas antes de registrar o aceite.";
    }
    return null;
  }, [
    checkingOpenRequests,
    noteType,
    openRequestActionIds,
    openRequestCheckError,
    plan.documents,
    plan.id,
    plan.status,
  ]);

  const requestBlocked =
    ["adjustment_request", "pending"].includes(noteType) && plan.status === "cancelled";
  const typeBlocked = Boolean(approvalBlockMessage) || requestBlocked;

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const trimmed = body.trim();
      if (!trimmed || typeBlocked) return;
      setSubmitting(true);
      setSubmitError(null);
      try {
        const created = await createSupervisionNote({
          recommendationId,
          actionPlanId: plan.id,
          noteType,
          body: trimmed,
        });
        setBody("");
        onCreated(created);
        setOpen(false);
        notify.success("Acompanhamento publicado.");
      } catch (caught) {
        setSubmitError(
          caught instanceof Error ? caught.message : "Falha ao publicar o acompanhamento.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [body, noteType, onCreated, plan.id, recommendationId, typeBlocked],
  );

  return (
    <PanelSection
      title="Acompanhamento"
      description="Registre uma orientação, comentário, solicitação ou decisão sobre a execução desta ação."
      size="compact"
    >
      {open ? (
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
          <label className={formSurface.fieldGroup} htmlFor="monitoring-note-type">
            <span className={formSurface.label}>Tipo</span>
            <select
              id="monitoring-note-type"
              value={noteType}
              onChange={(event) =>
                setNoteType(event.target.value as (typeof MONITORING_COMPOSER_TYPES)[number])
              }
              className={formSurface.inputSelect}
            >
              {MONITORING_COMPOSER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {MONITORING_COMPOSER_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          {approvalBlockMessage ? (
            <p className={formSurface.messageWarning}>{approvalBlockMessage}</p>
          ) : null}
          {requestBlocked ? (
            <p className={formSurface.messageWarning}>
              Não é possível abrir solicitação ou pendência em uma ação cancelada.
            </p>
          ) : null}
          <label className={formSurface.fieldGroup} htmlFor="monitoring-note-body">
            <span className={formSurface.label}>Registro</span>
            <textarea
              id="monitoring-note-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              maxLength={4000}
              placeholder={SUPERVISION_NOTE_META[noteType].description}
              className={formSurface.inputTextarea}
            />
          </label>
          {submitError ? <p role="alert" className={formSurface.messageError}>{submitError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={formSurface.secondaryButtonSm}
              onClick={() => setOpen(false)}
            >
              Cancelar
            </button>
            <LoadingButton
              type="submit"
              pending={submitting}
              pendingLabel="Publicando…"
              disabled={!body.trim() || submitting || typeBlocked}
              className={formSurface.primaryButtonSm}
            >
              Publicar acompanhamento
            </LoadingButton>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className={formSurface.secondaryButtonSm}
          onClick={() => setOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Registrar acompanhamento
        </button>
      )}
    </PanelSection>
  );
}
