"use client";

import { LoadingButton } from "@/shared/ui/components/loading";
import type { QueueProgress } from "@/features/validation/queue-model";

type Props = {
  progress: QueueProgress;
  dispatchingAdjustments: boolean;
  adjustmentDispatchError: string | null;
  consolidating: boolean;
  consolidationError: string | null;
  itemOrBatchPending: boolean;
  onDispatchAdjustments: () => void;
  onConsolidate: () => void;
};

export function ValidationQueueTransitionActions({
  progress,
  dispatchingAdjustments,
  adjustmentDispatchError,
  consolidating,
  consolidationError,
  itemOrBatchPending,
  onDispatchAdjustments,
  onConsolidate,
}: Props) {
  const preparedAdjustments =
    progress.adjustmentRequested + progress.proofRequested;
  const pendingAnalysis =
    progress.pending + progress.naPending + progress.notPresented;

  return (
    <>
      {preparedAdjustments > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            {preparedAdjustments === 1
              ? "Uma solicitação de ajuste está preparada."
              : `${preparedAdjustments} solicitações de ajuste estão preparadas.`}
          </p>
          <p className="mt-1 text-sm text-amber-800">
            {pendingAnalysis === 0
              ? "A análise da fila foi concluída. Envie todas as solicitações " +
                "ao respondente em uma única devolutiva."
              : pendingAnalysis === 1
                ? "Ainda falta 1 item para analisar. Conclua a fila antes de enviar a devolutiva."
                : `Ainda faltam ${pendingAnalysis} itens para analisar. Conclua a fila antes de enviar a devolutiva.`}
          </p>
          {adjustmentDispatchError ? (
            <p
              role="alert"
              aria-live="assertive"
              className={
                "mt-3 rounded-lg border border-rose-200 bg-rose-50 " +
                "px-3 py-2 text-sm text-rose-700"
              }
            >
              {adjustmentDispatchError}
            </p>
          ) : null}
          <LoadingButton
            type="button"
            pending={dispatchingAdjustments}
            pendingLabel="Enviando solicitações…"
            disabled={pendingAnalysis > 0 || itemOrBatchPending || consolidating}
            onClick={onDispatchAdjustments}
            className={
              "mt-3 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium " +
              "text-white transition hover:bg-amber-800 disabled:bg-slate-300"
            }
          >
            Enviar solicitações de ajuste
          </LoadingButton>
        </div>
      ) : null}

      {progress.readyToConsolidate ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            {progress.total === 0
              ? "Não há itens operacionais para validar."
              : "Todas as evidências e respostas “não se aplica” foram avaliadas."}
          </p>
          <p className="mt-1 text-sm text-green-700">
            Você pode concluir a validação e calcular o FAMI oficial.
          </p>
          {consolidationError ? (
            <p
              role="alert"
              aria-live="assertive"
              className={
                "mt-3 rounded-lg border border-rose-200 bg-rose-50 " +
                "px-3 py-2 text-sm text-rose-700"
              }
            >
              {consolidationError}
            </p>
          ) : null}
          <LoadingButton
            type="button"
            pending={consolidating}
            pendingLabel="Concluindo validação e calculando FAMI…"
            disabled={itemOrBatchPending || dispatchingAdjustments}
            onClick={onConsolidate}
            className={
              "mt-3 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium " +
              "text-white transition hover:bg-green-800 disabled:bg-slate-300"
            }
          >
            Concluir validação e calcular FAMI
          </LoadingButton>
        </div>
      ) : null}
    </>
  );
}
