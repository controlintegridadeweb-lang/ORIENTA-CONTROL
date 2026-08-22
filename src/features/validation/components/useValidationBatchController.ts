"use client";

import { useEffect, useMemo, useState } from "react";
import type { UnifiedFormCriterion } from "../contracts";
import {
  buildValidationBatchCommand,
  buildValidationBatchSelection,
  isCriterionBatchSelectable,
  type ValidationBatchAction,
  type ValidationBatchCommand,
  type ValidationBatchExecutionResult,
} from "../batch-actions";
import {
  loadQueueBatchSelection,
  saveQueueBatchSelection,
} from "../queue-state-storage";
import { useConfirm } from "@/shared/ui/components/confirm-dialog";
import { describeError, notify } from "@/infrastructure/notifications/notify";

export function useValidationBatchController({
  cycleId,
  criteria,
  disabled,
  onApplyBatch,
  onRefresh,
}: {
  cycleId: string;
  criteria: UnifiedFormCriterion[];
  disabled: boolean;
  onApplyBatch: (
    command: ValidationBatchCommand,
  ) => Promise<ValidationBatchExecutionResult>;
  onRefresh: () => void;
}) {
  const confirm = useConfirm();
  const [batchMode, setBatchMode] = useState(false);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedNaIds, setSelectedNaIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibleIds = useMemo(
    () => new Set(criteria.map((criterion) => criterion.responseId)),
    [criteria],
  );
  const visibleKey = [...visibleIds].join("|");
  const [prunedVisibleKey, setPrunedVisibleKey] = useState(visibleKey);

  if (prunedVisibleKey !== visibleKey) {
    setPrunedVisibleKey(visibleKey);
    setSelectedEvidenceIds(
      (current) => new Set([...current].filter((id) => visibleIds.has(id))),
    );
    setSelectedNaIds(
      (current) => new Set([...current].filter((id) => visibleIds.has(id))),
    );
  }

  useEffect(() => {
    const stored = loadQueueBatchSelection(cycleId);
    if (!stored) return;
    /* eslint-disable react-hooks/set-state-in-effect -- Hidrata a seleção persistida no sessionStorage após o mount, evitando divergência com o HTML do servidor. */
    setBatchMode(stored.batchMode);
    setSelectedEvidenceIds(new Set(stored.evidenceIds));
    setSelectedNaIds(new Set(stored.naIds));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [cycleId]);

  useEffect(() => {
    saveQueueBatchSelection(cycleId, {
      batchMode,
      evidenceIds: [...selectedEvidenceIds],
      naIds: [...selectedNaIds],
    });
  }, [batchMode, cycleId, selectedEvidenceIds, selectedNaIds]);

  const selectedResponseIds = useMemo(
    () => new Set([...selectedEvidenceIds, ...selectedNaIds]),
    [selectedEvidenceIds, selectedNaIds],
  );
  const selection = useMemo(
    () => buildValidationBatchSelection(criteria, selectedResponseIds),
    [criteria, selectedResponseIds],
  );

  function clearSelection() {
    setSelectedEvidenceIds(new Set());
    setSelectedNaIds(new Set());
    setError(null);
  }

  function toggleBatchMode() {
    if (batchMode) {
      clearSelection();
      setBatchMode(false);
      return;
    }
    setBatchMode(true);
  }

  function toggleCriterionSelection(criterion: UnifiedFormCriterion) {
    if (!isCriterionBatchSelectable(criterion)) return;
    const setter = criterion.notApplicableItem
      ? setSelectedNaIds
      : setSelectedEvidenceIds;
    setter((current) => {
      const next = new Set(current);
      if (next.has(criterion.responseId)) next.delete(criterion.responseId);
      else next.add(criterion.responseId);
      return next;
    });
    setError(null);
  }

  async function applyBatch(
    action: ValidationBatchAction,
    justification: string,
  ): Promise<boolean> {
    if (disabled || pending) return false;
    const option = selection.options.find((item) => item.action === action);
    if (!option) {
      setError("A ação não é compatível com todos os critérios selecionados.");
      return false;
    }
    if (option.requiresJustification && !justification.trim()) {
      setError("Informe a justificativa para aplicar a decisão em lote.");
      return false;
    }

    const confirmed = await confirm({
      title: `${option.label} em lote?`,
      description: `A decisão será aplicada a ${selection.criteria.length} critério(s) selecionado(s).`,
      confirmLabel: "Aplicar decisão",
      cancelLabel: "Cancelar",
      tone:
        action === "invalidate_evidence" ||
        action === "reject_not_applicable"
          ? "danger"
          : "default",
    });
    if (!confirmed) return false;

    setPending(true);
    setError(null);
    try {
      const command = buildValidationBatchCommand(
        selection,
        action,
        justification,
      );
      const result = await onApplyBatch(command);
      const failures = result.results.filter((item) => item.status === "failed");
      const successes = result.results.length - failures.length;
      if (failures.length > 0) {
        notify.warning(
          `${successes} item(ns) atualizado(s) e ${failures.length} não puderam ser alterados.`,
          { description: failures[0]?.message },
        );
      } else {
        notify.success("Decisão em lote aplicada com sucesso.");
      }
      clearSelection();
      onRefresh();
      return true;
    } catch (caught) {
      setError(describeError(caught, "Falha ao aplicar a decisão em lote."));
      return false;
    } finally {
      setPending(false);
    }
  }

  return {
    batchMode,
    toggleBatchMode,
    selectedEvidenceIds,
    selectedNaIds,
    selectedCount: selectedResponseIds.size,
    selection,
    pending,
    error,
    clearSelection,
    toggleCriterionSelection,
    isCriterionSelectable: isCriterionBatchSelectable,
    applyBatch,
  };
}
