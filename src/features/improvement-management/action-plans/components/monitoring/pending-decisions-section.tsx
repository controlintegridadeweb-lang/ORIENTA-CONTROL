"use client";

import { useState } from "react";
import type {
  ActionPlanDeadlineChangeRequest,
  SupervisionNoteEntry,
} from "@/features/improvement-management/action-plans/types";
import {
  SUPERVISION_LIFECYCLE_META,
  SUPERVISION_NOTE_META,
} from "@/features/improvement-management/action-plans/supervision-presentation";
import type {
  SupervisionLifecycleStatus,
  SupervisionNoteType,
} from "@/features/improvement-management/action-plans/schemas";
import {
  decideAdminDeadlineChange,
  decideSupervisionRequest,
  respondToSupervisionRequest,
} from "@/features/improvement-management/action-plans/client";
import type { PendingMonitoringItem } from "@/features/improvement-management/action-plans/monitoring/build-monitoring-history";
import { formatMonitoringDateTime } from "@/features/improvement-management/action-plans/monitoring/format-monitoring-datetime";
import { formatLocalDate } from "@/shared/datetime/business-date";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { LoadingButton } from "@/shared/ui/components/loading";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import { notify } from "@/infrastructure/notifications/notify";
import { useConfirm } from "@/shared/ui/components/confirm-dialog";
import { statusPillBase } from "@/shared/ui/components/status-pill";

function DeadlinePendingCard({
  request,
  canDecide,
  onUpdated,
}: {
  request: ActionPlanDeadlineChangeRequest;
  canDecide: boolean;
  onUpdated: (updated: ActionPlanDeadlineChangeRequest) => void;
}) {
  const confirm = useConfirm();
  const [decisionReason, setDecisionReason] = useState("");
  const [deciding, setDeciding] = useState(false);

  async function decide(decision: "approved" | "rejected") {
    const trimmed = decisionReason.trim();
    if (trimmed.length < 5) {
      notify.error("Informe a justificativa da decisão.");
      return;
    }
    const title = decision === "approved" ? "Aprovar alteração de prazo?" : "Recusar alteração de prazo?";
    const confirmLabel = decision === "approved" ? "Aprovar alteração" : "Recusar";
    if (!(await confirm({ title, confirmLabel }))) return;

    setDeciding(true);
    try {
      const updated = await decideAdminDeadlineChange({
        requestId: request.id,
        decision,
        decisionReason: trimmed,
      });
      onUpdated(updated);
      notify.success(
        decision === "approved"
          ? "Novo prazo aprovado e aplicado à ação."
          : "Solicitação de alteração de prazo recusada.",
      );
    } catch (caught) {
      notify.error(caught instanceof Error ? caught.message : "Falha ao registrar a decisão.");
    } finally {
      setDeciding(false);
    }
  }

  return (
    <article className={`${formSurface.nestedCard} space-y-3`}>
      <div>
        <h3 className={typography.cardTitle}>Solicitação de alteração de prazo</h3>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-slate-500">Prazo atual</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-900">
            {formatLocalDate(request.previousDueDate)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Novo prazo solicitado</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-900">
            {formatLocalDate(request.requestedDueDate)}
          </dd>
        </div>
      </dl>
      <div>
        <p className="text-xs font-medium text-slate-500">Justificativa</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{request.reason}</p>
      </div>
      <p className={typography.meta}>
        Solicitado por {request.requestedByName} · {formatMonitoringDateTime(request.requestedAt)}
      </p>

      {canDecide ? (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <label className={formSurface.fieldGroup}>
            <span className={formSurface.label}>Justificativa da decisão</span>
            <textarea
              value={decisionReason}
              onChange={(event) => setDecisionReason(event.target.value)}
              rows={2}
              minLength={5}
              maxLength={4000}
              className={formSurface.inputTextarea}
              placeholder="Registre os fundamentos para aprovar ou recusar o novo prazo."
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <LoadingButton
              type="button"
              pending={deciding}
              pendingLabel="Salvando…"
              disabled={deciding || decisionReason.trim().length < 5}
              className={formSurface.secondaryButtonSm}
              onClick={() => void decide("rejected")}
            >
              Recusar
            </LoadingButton>
            <LoadingButton
              type="button"
              pending={deciding}
              pendingLabel="Salvando…"
              disabled={deciding || decisionReason.trim().length < 5}
              className={formSurface.primaryButtonSm}
              onClick={() => void decide("approved")}
            >
              Aprovar alteração
            </LoadingButton>
          </div>
        </div>
      ) : (
        <p className={typography.meta}>Aguardando decisão da supervisão.</p>
      )}
    </article>
  );
}

function SupervisionPendingCard({
  note,
  role,
  onUpdated,
}: {
  note: SupervisionNoteEntry;
  role: "admin" | "respondent";
  onUpdated: (updated: SupervisionNoteEntry) => void;
}) {
  const confirm = useConfirm();
  const [resolutionBody, setResolutionBody] = useState("");
  const [responseBody, setResponseBody] = useState("");
  const [busy, setBusy] = useState(false);
  const type = SUPERVISION_NOTE_META[note.noteType as SupervisionNoteType] ?? SUPERVISION_NOTE_META.comment;
  const lifecycle =
    SUPERVISION_LIFECYCLE_META[note.lifecycleStatus as SupervisionLifecycleStatus]
    ?? SUPERVISION_LIFECYCLE_META.recorded;
  const canDecide =
    role === "admin"
    && note.lifecycleStatus === "acknowledged"
    && ["adjustment_request", "pending"].includes(note.noteType);
  const canRespond =
    role === "respondent"
    && note.lifecycleStatus === "open"
    && ["adjustment_request", "pending"].includes(note.noteType);

  async function decide(decision: "resolved" | "cancelled") {
    const title =
      decision === "resolved"
        ? "Considerar esta solicitação atendida?"
        : "Encerrar esta solicitação para registrar um novo ajuste?";
    const confirmLabel = decision === "resolved" ? "Considerar atendida" : "Solicitar novo ajuste";
    if (!(await confirm({ title, confirmLabel }))) return;
    setBusy(true);
    try {
      const updated = await decideSupervisionRequest({
        noteId: note.id,
        decision,
        resolutionBody: resolutionBody.trim(),
      });
      onUpdated(updated);
      notify.success(
        decision === "resolved"
          ? "Solicitação considerada atendida."
          : "Solicitação encerrada. Você pode registrar um novo ajuste.",
      );
    } catch (caught) {
      notify.error(caught instanceof Error ? caught.message : "Falha ao registrar a decisão.");
    } finally {
      setBusy(false);
    }
  }

  async function respond() {
    const trimmed = responseBody.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const updated = await respondToSupervisionRequest({
        noteId: note.id,
        responseBody: trimmed,
      });
      onUpdated(updated);
      setResponseBody("");
      notify.success("Ajuste informado à supervisão.");
    } catch (caught) {
      notify.error(caught instanceof Error ? caught.message : "Falha ao informar o ajuste.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`${formSurface.nestedCard} space-y-3`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${statusPillBase} ${type.badgeClass}`}>{type.label}</span>
        <span className={`${statusPillBase} ${lifecycle.badgeClass}`}>{lifecycle.label}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{note.body}</p>
      <p className={typography.meta}>
        {note.authorName} · {formatMonitoringDateTime(note.createdAt)}
      </p>
      {note.responseBody ? (
        <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
          <p className="font-medium">Providência informada</p>
          <p className="mt-1 whitespace-pre-wrap">{note.responseBody}</p>
        </div>
      ) : role === "admin" && note.lifecycleStatus === "open" ? (
        <p className={typography.meta}>Aguardando providência do respondente.</p>
      ) : null}

      {canRespond ? (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <label className={formSurface.fieldGroup}>
            <span className={formSurface.label}>O que foi ajustado?</span>
            <textarea
              value={responseBody}
              onChange={(event) => setResponseBody(event.target.value)}
              rows={2}
              maxLength={4000}
              className={formSurface.inputTextarea}
            />
          </label>
          <div className="flex justify-end">
            <LoadingButton
              type="button"
              pending={busy}
              pendingLabel="Enviando…"
              disabled={!responseBody.trim() || busy}
              className={formSurface.primaryButtonSm}
              onClick={() => void respond()}
            >
              Informar ajuste realizado
            </LoadingButton>
          </div>
        </div>
      ) : null}

      {canDecide ? (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <label className={formSurface.fieldGroup}>
            <span className={formSurface.label}>Justificativa da decisão</span>
            <textarea
              value={resolutionBody}
              onChange={(event) => setResolutionBody(event.target.value)}
              rows={2}
              maxLength={4000}
              className={formSurface.inputTextarea}
            />
          </label>
          {note.lifecycleStatus === "open" ? (
            <p className={typography.meta}>
              A resolução será liberada após o respondente informar o atendimento.
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <LoadingButton
              type="button"
              pending={busy}
              pendingLabel="Salvando…"
              disabled={!resolutionBody.trim() || busy}
              className={formSurface.secondaryButtonSm}
              onClick={() => void decide("cancelled")}
            >
              Solicitar novo ajuste
            </LoadingButton>
            <LoadingButton
              type="button"
              pending={busy}
              pendingLabel="Salvando…"
              disabled={!resolutionBody.trim() || busy}
              className={formSurface.primaryButtonSm}
              onClick={() => void decide("resolved")}
            >
              Considerar atendida
            </LoadingButton>
          </div>
        </div>
      ) : null}
    </article>
  );
}

type Props = {
  items: PendingMonitoringItem[];
  role: "admin" | "respondent";
  loading: boolean;
  onDeadlineUpdated: (updated: ActionPlanDeadlineChangeRequest) => Promise<void> | void;
  onNoteUpdated: (updated: SupervisionNoteEntry) => Promise<void> | void;
};

export function PendingDecisionsSection({
  items,
  role,
  loading,
  onDeadlineUpdated,
  onNoteUpdated,
}: Props) {
  return (
    <PanelSection title="Pendências e decisões" size="compact">
      {loading && items.length === 0 ? (
        <p className={typography.auxiliary}>Carregando pendências…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">Nenhuma pendência para esta ação.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.kind === "deadline" ? item.request.id : item.note.id}>
              {item.kind === "deadline" ? (
                <DeadlinePendingCard
                  request={item.request}
                  canDecide={role === "admin"}
                  onUpdated={(updated) => void onDeadlineUpdated(updated)}
                />
              ) : (
                <SupervisionPendingCard
                  note={item.note}
                  role={role}
                  onUpdated={(updated) => void onNoteUpdated(updated)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </PanelSection>
  );
}
