"use client";

import { typography } from "@/shared/layout/design-system";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import type {
  ActionPlanDeadlineChangeRequest,
  ActionPlanDeadlineChangeTarget,
} from "@/features/improvement-management/action-plans/types";
import {
  listRespondentDeadlineChangeRequests,
  requestRespondentDeadlineChange,
} from "@/features/improvement-management/action-plans/client";
import { formatLocalDate } from "@/shared/datetime/business-date";
import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import { formSurface } from "@/shared/layout/form-surface";
import { InlineLoader, LoadingButton } from "@/shared/ui/components/loading";
import { describeError, notify } from "@/infrastructure/notifications/notify";

const statusLabel: Record<ActionPlanDeadlineChangeRequest["status"], string> = {
  pending: "Aguardando decisão",
  approved: "Aprovada",
  rejected: "Não aprovada",
};

const statusClass: Record<ActionPlanDeadlineChangeRequest["status"], string> = {
  pending: formSurface.badge.warning,
  approved: formSurface.badge.success,
  rejected: formSurface.badge.danger,
};

const copy = {
  due_date: {
    title: "Alteração do final",
    intro: "O final vigente permanece válido até a supervisão aprovar a solicitação.",
    loading: "Carregando solicitações de final…",
    loadError: "Falha ao carregar as solicitações de final.",
    submitError: "Falha ao solicitar a alteração do final.",
    success: "Solicitação de alteração do final enviada para a supervisão.",
    currentLabel: "Final vigente",
    requestedLabel: "Novo final solicitado",
    pendingCurrent: "Final vigente",
    pendingRequested: "Final solicitado",
    placeholder: "Explique por que o final precisa ser alterado e quais fatores impactaram a entrega.",
    submit: "Solicitar alteração do final",
  },
  start_date: {
    title: "Alteração do início",
    intro: "O início vigente permanece válido até a supervisão aprovar a solicitação.",
    loading: "Carregando solicitações de início…",
    loadError: "Falha ao carregar as solicitações de início.",
    submitError: "Falha ao solicitar a alteração do início.",
    success: "Solicitação de alteração do início enviada para a supervisão.",
    currentLabel: "Início vigente",
    requestedLabel: "Novo início solicitado",
    pendingCurrent: "Início vigente",
    pendingRequested: "Início solicitado",
    placeholder: "Explique por que o início precisa ser alterado e quais fatores impactaram o planejamento.",
    submit: "Solicitar alteração do início",
  },
} as const;

function dateTime(value: string): string {
  return formatPlatformDateTime(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shownDate(
  request: ActionPlanDeadlineChangeRequest,
  target: ActionPlanDeadlineChangeTarget,
  which: "previous" | "requested",
): string {
  const value =
    target === "start_date"
      ? which === "previous"
        ? request.previousStartDate
        : request.requestedStartDate
      : which === "previous"
        ? request.previousDueDate
        : request.requestedDueDate;
  return value ? formatLocalDate(value) : "—";
}

type Props = {
  plan: ActionPlanAction;
  recommendationId: string;
  target?: ActionPlanDeadlineChangeTarget;
  onSaved: () => Promise<void>;
  onCancel: () => void;
};

export function RequestDeadlineChangeForm({
  plan,
  recommendationId,
  target = "due_date",
  onSaved,
  onCancel,
}: Props) {
  const labels = copy[target];
  const [requests, setRequests] = useState<ActionPlanDeadlineChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestedDate, setRequestedDate] = useState("");
  const [reason, setReason] = useState("");
  const [loadedKey, setLoadedKey] = useState(`${plan.id}:${target}`);

  if (loadedKey !== `${plan.id}:${target}`) {
    setLoadedKey(`${plan.id}:${target}`);
    setRequests([]);
    setLoading(true);
    setError(null);
    setRequestedDate("");
    setReason("");
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await listRespondentDeadlineChangeRequests({
        planId: plan.id,
        target,
        limit: 5,
        offset: 0,
      });
      setRequests(page.items);
    } catch (caught) {
      setError(describeError(caught, labels.loadError));
    } finally {
      setLoading(false);
    }
  }, [labels.loadError, plan.id, target]);

  useEffect(() => {
    let cancelled = false;
    void listRespondentDeadlineChangeRequests({
      planId: plan.id,
      target,
      limit: 5,
      offset: 0,
    })
      .then((page) => {
        if (!cancelled) setRequests(page.items);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(describeError(caught, labels.loadError));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [labels.loadError, plan.id, target]);

  const scopedRequests = useMemo(
    () => requests.filter((request) => request.changeTarget === target),
    [requests, target],
  );

  const pendingRequest = useMemo(
    () => scopedRequests.find((request) => request.status === "pending") ?? null,
    [scopedRequests],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!requestedDate || !reason.trim()) return;
    setSubmitting(true);
    try {
      await requestRespondentDeadlineChange({
        planId: plan.id,
        recommendationId,
        expectedRevision: plan.revision,
        target,
        ...(target === "start_date"
          ? { requestedStartDate: requestedDate }
          : { requestedDueDate: requestedDate }),
        reason: reason.trim(),
      });
      setRequestedDate("");
      setReason("");
      notify.success(labels.success);
      await Promise.all([load(), onSaved()]);
    } catch (caught) {
      setError(describeError(caught, labels.submitError));
    } finally {
      setSubmitting(false);
    }
  }

  const currentDate = target === "start_date" ? plan.startDate : plan.dueDate;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className={typography.subsectionTitle}>{labels.title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{labels.intro}</p>
        </div>
        <button type="button" className={formSurface.ghostButton} onClick={onCancel}>
          fechar
        </button>
      </div>

      {error ? <p role="alert" className={formSurface.messageError}>{error}</p> : null}
      {loading ? <InlineLoader label={labels.loading} /> : null}

      {pendingRequest ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Solicitação em análise</p>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass.pending}`}>
              {statusLabel.pending}
            </span>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-slate-500">{labels.pendingCurrent}</dt>
              <dd className="mt-0.5 font-semibold text-slate-900">
                {shownDate(pendingRequest, target, "previous")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">{labels.pendingRequested}</dt>
              <dd className="mt-0.5 font-semibold text-slate-900">
                {shownDate(pendingRequest, target, "requested")}
              </dd>
            </div>
          </dl>
          <div>
            <p className="text-xs font-medium text-slate-500">Justificativa</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{pendingRequest.reason}</p>
          </div>
          <p className="text-xs text-slate-500">
            Enviada por {pendingRequest.requestedByName} em {dateTime(pendingRequest.requestedAt)}.
          </p>
        </div>
      ) : !loading ? (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={formSurface.fieldGroup}>
              <span className={formSurface.label}>{labels.currentLabel}</span>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800">
                {formatLocalDate(currentDate)}
              </div>
            </div>
            <label className={formSurface.fieldGroup}>
              <span className={formSurface.label}>{labels.requestedLabel}</span>
              <input
                type="date"
                value={requestedDate}
                min={target === "due_date" ? plan.startDate : undefined}
                max={target === "start_date" ? plan.dueDate : undefined}
                onChange={(event) => setRequestedDate(event.target.value)}
                className={formSurface.input}
                required
              />
            </label>
          </div>

          <label className={formSurface.fieldGroup}>
            <span className={formSurface.label}>Justificativa da alteração</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              minLength={10}
              maxLength={4000}
              className={formSurface.inputTextarea}
              placeholder={labels.placeholder}
              required
            />
            <span className="text-xs text-slate-500">
              A justificativa ficará registrada no histórico administrativo da ação.
            </span>
          </label>

          <LoadingButton
            type="submit"
            pending={submitting}
            pendingLabel="Enviando…"
            disabled={!requestedDate || reason.trim().length < 10}
            className={`${formSurface.primaryButton} w-full justify-center sm:w-auto`}
          >
            {labels.submit}
          </LoadingButton>
        </form>
      ) : null}

      {!loading && scopedRequests.some((request) => request.status !== "pending") ? (
        <div className="space-y-2 border-t border-slate-200 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Decisões anteriores</p>
          {scopedRequests
            .filter((request) => request.status !== "pending")
            .slice(0, 3)
            .map((request) => (
              <div key={request.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-700">
                    {shownDate(request, target, "previous")} → {shownDate(request, target, "requested")}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass[request.status]}`}>
                    {statusLabel[request.status]}
                  </span>
                </div>
                {request.decisionReason ? (
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{request.decisionReason}</p>
                ) : null}
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}
