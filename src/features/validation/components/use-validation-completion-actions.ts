"use client";

import { useState } from "react";
import { useConfirm } from "@/shared/ui/components/confirm-dialog";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import type { QueueProgress } from "../queue-model";

export function useValidationCompletionActions({
  locked,
  progress,
  onDispatchAdjustments,
  onConsolidate,
  flushPendingAutosave,
}: {
  locked: boolean;
  progress: QueueProgress;
  onDispatchAdjustments: () => Promise<{
    adjustmentCount: number;
    proofRequestCount?: number;
    totalCount?: number;
  }>;
  onConsolidate: () => Promise<void>;
  flushPendingAutosave?: () => Promise<void>;
  hasUnconfirmedAutosave?: boolean;
}) {
  const confirm = useConfirm();
  const [dispatchingAdjustments, setDispatchingAdjustments] = useState(false);
  const [adjustmentDispatchError, setAdjustmentDispatchError] = useState<
    string | null
  >(null);
  const [consolidating, setConsolidating] = useState(false);
  const [consolidationError, setConsolidationError] = useState<string | null>(
    null,
  );

  const busy = dispatchingAdjustments || consolidating;

  async function handleDispatchAdjustments() {
    if (locked || busy) return;
    const preparedCount =
      progress.adjustmentRequested + progress.proofRequested;
    const confirmed = await confirm({
      title:
        preparedCount === 1
          ? "Enviar solicitação de ajuste?"
          : `Enviar ${preparedCount} solicitações de ajuste?`,
      description:
        preparedCount === 1
          ? "O respondente será notificado e deverá corrigir a pendência antes de reenviar o diagnóstico."
          : "O respondente será notificado e deverá corrigir todas as pendências antes de reenviar o diagnóstico.",
      confirmLabel:
        preparedCount === 1 ? "Enviar solicitação" : "Enviar solicitações",
    });
    if (!confirmed) return;
    setDispatchingAdjustments(true);
    setAdjustmentDispatchError(null);
    try {
      const result = await onDispatchAdjustments();
      const sentCount =
        result.totalCount ??
        result.adjustmentCount + (result.proofRequestCount ?? 0);
      notify.success(
        sentCount === 1
          ? "Solicitação de ajuste enviada ao respondente."
          : `${sentCount} solicitações de ajuste enviadas ao respondente.`,
      );
    } catch (caught) {
      setAdjustmentDispatchError(
        describeError(caught, "Falha ao enviar as solicitações de ajuste."),
      );
    } finally {
      setDispatchingAdjustments(false);
    }
  }

  async function handleConsolidate() {
    if (locked || busy) return;
    setConsolidationError(null);
    if (flushPendingAutosave) {
      try {
        await flushPendingAutosave();
      } catch (caught) {
        setConsolidationError(
          describeError(
            caught,
            "Aguarde o salvamento do rascunho antes de concluir a validação.",
          ),
        );
        return;
      }
    }
    const confirmed = await confirm({
      title: "Concluir validação e calcular FAMI?",
      description:
        "Esta ação encerra a validação, consolida os resultados e calcula o " +
        "FAMI oficial. Verifique os pareceres antes de continuar.",
      confirmLabel: "Concluir e calcular FAMI",
    });
    if (!confirmed) return;
    setConsolidating(true);
    setConsolidationError(null);
    try {
      if (flushPendingAutosave) {
        await flushPendingAutosave();
      }
      await onConsolidate();
      notify.success("Validação concluída e FAMI calculado com sucesso.");
    } catch (caught) {
      setConsolidationError(
        describeError(
          caught,
          "Falha ao concluir a validação e calcular o FAMI.",
        ),
      );
    } finally {
      setConsolidating(false);
    }
  }

  return {
    dispatchingAdjustments,
    adjustmentDispatchError,
    consolidating,
    consolidationError,
    busy,
    handleDispatchAdjustments,
    handleConsolidate,
  };
}
