"use client";

import { typography } from "@/shared/layout/design-system";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CycleListItem } from "@/features/cycles/cycle-queries";
import { transitionAdminCycle } from "@/features/cycles/client";
import type { ActionPlanCompletionReadiness } from "@/features/improvement-management";
import { useConfirm } from "@/shared/ui/components/confirm-dialog";
import { LoadingButton } from "@/shared/ui/components/loading";
import { formSurface } from "@/shared/layout/form-surface";
import { describeError, notify } from "@/infrastructure/notifications/notify";

function pendingSummary(readiness: ActionPlanCompletionReadiness): string[] {
  const lines: string[] = [];
  if (readiness.countsByReason.exception_pending > 0) {
    lines.push(
      `${readiness.countsByReason.exception_pending} solicitação(ões) de exceção aguardando decisão`,
    );
  }
  if (readiness.countsByReason.missing_active_action > 0) {
    lines.push(
      `${readiness.countsByReason.missing_active_action} recomendação(ões) sem ação ativa`,
    );
  }
  if (readiness.countsByReason.action_not_completed > 0) {
    lines.push(
      `${readiness.countsByReason.action_not_completed} ação(ões) ainda não concluída(s)`,
    );
  }
  if (readiness.countsByReason.open_supervision_request > 0) {
    lines.push(
      `${readiness.countsByReason.open_supervision_request} solicitação(ões) de supervisão abertas`,
    );
  }
  if (readiness.countsByReason.missing_execution_evidence > 0) {
    lines.push(
      `${readiness.countsByReason.missing_execution_evidence} ação(ões) concluída(s) sem comprovação válida`,
    );
  }
  if (readiness.countsByReason.action_not_approved > 0) {
    lines.push(
      `${readiness.countsByReason.action_not_approved} ação(ões) sem aceite válido`,
    );
  }
  return lines;
}

/**
 * Encerramento da avaliação — seção própria, fora do fluxo de reabertura.
 */
export function CycleCloseActions({
  cycle,
  completionReadiness,
}: {
  cycle: CycleListItem;
  completionReadiness: ActionPlanCompletionReadiness | null;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (cycle.state !== "validated") return null;

  const actionPlanReady = completionReadiness?.ready !== false;
  const referenceReady =
    cycle.referenceStartYear != null && cycle.referenceEndYear != null;
  const ready = actionPlanReady && referenceReady;
  const summary = completionReadiness && !actionPlanReady
    ? pendingSummary(completionReadiness)
    : [];
  const planHref = `/admin/plano-acao?organizationId=${encodeURIComponent(cycle.organizationId)}&formId=${encodeURIComponent(cycle.formId)}&cycleId=${encodeURIComponent(cycle.id)}`;
  const reportsHref = `/admin/relatorios?organizationId=${encodeURIComponent(cycle.organizationId)}&cycleId=${encodeURIComponent(cycle.id)}`;

  async function handleClose() {
    if (
      !(await confirm({
        title: "Encerrar avaliação?",
        description:
          "O diagnóstico passará para Avaliação encerrada e a primeira emissão do relatório oficial será iniciada automaticamente.",
        confirmLabel: "Encerrar avaliação",
        cancelLabel: "Cancelar",
      }))
    ) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      const result = await transitionAdminCycle(cycle.id, "completed");
      if (result.report?.status === "emission_failed") {
        notify.warning(
          result.report.message ??
            "Avaliação encerrada, mas a emissão automática do relatório falhou.",
        );
      } else if (result.report?.status === "emitting") {
        notify.success("Avaliação encerrada. O relatório oficial está sendo emitido.");
      } else {
        notify.success("Avaliação encerrada e relatório oficial emitido.");
      }
      router.refresh();
    } catch (caught) {
      setError(describeError(caught, "Falha ao encerrar a avaliação."));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5 border-t border-slate-200 pt-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className={typography.cardTitle}>
            Encerramento da avaliação
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Disponível após o acompanhamento do plano de ação.
          </p>
          {!actionPlanReady && summary.length > 0 ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Pendências no plano de ação: {summary.join("; ")}.{" "}
              <Link
                href={planHref}
                className="font-medium text-brand-700 hover:underline"
              >
                Abrir plano de ação
              </Link>
            </p>
          ) : !referenceReady ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Defina o período de referência institucional antes do encerramento.{" "}
              <Link
                href={reportsHref}
                className="font-medium text-brand-700 hover:underline"
              >
                Definir referência
              </Link>
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              O plano de ação e a referência institucional estão aptos. Ao encerrar,
              o relatório oficial será emitido automaticamente.
            </p>
          )}
          {error ? (
            <p role="alert" className={`mt-2 ${formSurface.messageError}`}>
              {error}
            </p>
          ) : null}
        </div>
        <LoadingButton
          type="button"
          pending={pending}
          pendingLabel="Encerrando…"
          disabled={pending || !ready}
          onClick={() => void handleClose()}
          className={`${formSurface.secondaryButtonSm} shrink-0`}
        >
          Encerrar avaliação
        </LoadingButton>
      </div>
    </div>
  );
}
