"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  decideRecommendationException,
  listRecommendationExceptions,
  requestRecommendationException,
  type RecommendationException,
} from "@/features/library";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import { formSurface } from "@/shared/layout/form-surface";
import { LoadingButton } from "@/shared/ui/components/loading";
import { Drawer } from "@/shared/ui/components/drawer";
import { useRecommendationDetailContext } from "./recommendation-detail-context";
import { businessToday, formatLocalDate } from "@/shared/datetime/business-date";
import {
  OverviewBlockTitle,
  OverviewMetaGrid,
  OverviewMetaItem,
  OverviewSoftPanel,
  RecommendationCardField,
  RecommendationCardText,
  overviewStack,
} from "./overview-section-primitives";

const STATUS_LABEL: Record<RecommendationException["status"], string> = {
  requested: "Em análise",
  approved: "Aprovada",
  rejected: "Rejeitada",
  expired: "Expirada",
};

function ExceptionDetails({ item }: { item: RecommendationException }) {
  return (
    <OverviewMetaGrid>
      <OverviewMetaItem label="Situação" value={STATUS_LABEL[item.status]} />
      <OverviewMetaItem
        label="Data da solicitação"
        value={formatLocalDate(item.requestedAt.slice(0, 10), {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      />
      <div className="sm:col-span-2">
        <RecommendationCardField label="Justificativa">
          <RecommendationCardText preWrap>{item.motivo}</RecommendationCardText>
        </RecommendationCardField>
      </div>
      {item.prazo ? (
        <OverviewMetaItem
          label="Prazo"
          value={formatLocalDate(item.prazo, {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        />
      ) : null}
      {item.decidedAt ? (
        <OverviewMetaItem
          label="Decisão administrativa"
          value={`${STATUS_LABEL[item.status]} · ${formatLocalDate(item.decidedAt.slice(0, 10), {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}`}
        />
      ) : null}
    </OverviewMetaGrid>
  );
}

export function RecommendationExceptionPanel() {
  const ctx = useRecommendationDetailContext();
  const row = ctx.row;
  const [items, setItems] = useState<RecommendationException[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!row) return;
    setLoading(true);
    setError(null);
    try {
      const all = await listRecommendationExceptions(ctx.role, row.organizationId);
      setItems(all.filter((item) => item.recommendationId === row.recommendationId));
    } catch (cause) {
      setError(describeError(cause, "Falha ao carregar as exceções."));
    } finally {
      setLoading(false);
    }
  }, [ctx.role, row]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Carrega a lista assíncrona ao montar / trocar a recomendação.
    void load();
  }, [load]);

  const active = useMemo(
    () => items.find((item) => item.status === "requested" || item.status === "approved") ?? null,
    [items],
  );
  const latestClosed = useMemo(
    () => items.find((item) => item.status === "rejected" || item.status === "expired") ?? null,
    [items],
  );

  if (!row) return null;
  const hasActiveActions = row.plans.some((plan) => plan.status !== "cancelled");
  const canRequest =
    ctx.role === "respondent" &&
    row.cycleState === "validated" &&
    !active &&
    !hasActiveActions;

  async function requestException(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await requestRecommendationException({
        organizationId: row!.organizationId,
        recommendationId: row!.recommendationId,
        questionId: row!.questionId,
        motivo: String(form.get("motivo") ?? ""),
        prazo: String(form.get("prazo") ?? "") || null,
      });
      notify.success("Solicitação de exceção enviada para análise.");
      setDrawerOpen(false);
      await Promise.all([load(), ctx.refetch()]);
    } catch (cause) {
      setError(describeError(cause, "Falha ao solicitar a exceção."));
    } finally {
      setPending(false);
    }
  }

  async function decide(id: string, status: "approved" | "rejected") {
    setPending(true);
    setError(null);
    try {
      await decideRecommendationException(id, status);
      notify.success(status === "approved" ? "Exceção aprovada." : "Exceção rejeitada.");
      await Promise.all([load(), ctx.refetch()]);
    } catch (cause) {
      setError(describeError(cause, "Falha ao registrar a decisão."));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <section aria-labelledby="rec-exception-heading" className={overviewStack}>
        <OverviewBlockTitle
          id="rec-exception-heading"
          title="Exceção institucional"
          description="Utilize apenas quando houver impedimento formal para executar esta recomendação."
        />

        <OverviewSoftPanel className="space-y-4">
          {error ? <p role="alert" className={formSurface.messageError}>{error}</p> : null}
          {loading ? (
            <RecommendationCardText variant="meta">
              Carregando situação da exceção…
            </RecommendationCardText>
          ) : (
            <div className={overviewStack}>
              {active ? (
                <div className={overviewStack}>
                  <ExceptionDetails item={active} />
                  {ctx.role === "admin" && active.status === "requested" ? (
                    <div className="flex flex-wrap gap-2">
                      <LoadingButton
                        type="button"
                        pending={pending}
                        pendingLabel="Aprovando…"
                        onClick={() => void decide(active.id, "approved")}
                        className={formSurface.primaryButtonSm}
                      >
                        Aprovar exceção
                      </LoadingButton>
                      <LoadingButton
                        type="button"
                        pending={pending}
                        pendingLabel="Rejeitando…"
                        onClick={() => void decide(active.id, "rejected")}
                        className={formSurface.dangerButton}
                      >
                        Rejeitar exceção
                      </LoadingButton>
                    </div>
                  ) : null}
                </div>
              ) : latestClosed ? (
                <div className={overviewStack}>
                  <ExceptionDetails item={latestClosed} />
                  <RecommendationCardText variant="meta">
                    Uma nova solicitação pode ser apresentada enquanto o ciclo estiver validado.
                  </RecommendationCardText>
                </div>
              ) : (
                <RecommendationCardText variant="body">
                  Nenhuma exceção registrada.
                </RecommendationCardText>
              )}

              {ctx.role === "respondent" &&
              row.cycleState === "validated" &&
              !active &&
              hasActiveActions ? (
                <p className={formSurface.messageWarning}>
                  Cancele as ações ainda ativas antes de solicitar uma exceção institucional para
                  esta recomendação.
                </p>
              ) : null}

              {canRequest ? (
                <div>
                  <button
                    type="button"
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    onClick={() => setDrawerOpen(true)}
                  >
                    Solicitar exceção
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </OverviewSoftPanel>
      </section>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Solicitar exceção"
        description="Informe o impedimento formal e, se houver, o prazo de validade da solicitação."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={formSurface.secondaryButtonSm}
              onClick={() => setDrawerOpen(false)}
            >
              Cancelar
            </button>
            <LoadingButton
              type="submit"
              form="recommendation-exception-request-form"
              pending={pending}
              pendingLabel="Enviando…"
              className={formSurface.primaryButtonSm}
            >
              Enviar solicitação
            </LoadingButton>
          </div>
        }
      >
        <form
          id="recommendation-exception-request-form"
          onSubmit={requestException}
          className="space-y-4"
        >
          <label className={formSurface.fieldGroup}>
            <span className={formSurface.label}>Justificativa institucional</span>
            <textarea
              name="motivo"
              minLength={20}
              maxLength={4000}
              rows={5}
              required
              className={formSurface.inputTextarea}
              placeholder="Descreva o impedimento, a base institucional e por que a execução não é viável."
            />
          </label>
          <label className={formSurface.fieldGroup}>
            <span className={formSurface.label}>Prazo de validade da solicitação</span>
            <input
              name="prazo"
              type="date"
              min={businessToday()}
              className={formSurface.input}
            />
            <span className="text-xs text-slate-500">
              Opcional. Após esse prazo, uma solicitação ainda não decidida expira automaticamente.
            </span>
          </label>
        </form>
      </Drawer>
    </>
  );
}
