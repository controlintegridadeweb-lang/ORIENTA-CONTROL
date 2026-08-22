"use client";

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { sectionStorageKey } from "@/features/workbench/section-progress";

type Params = {
  cycleId: string;
  enabled: boolean;
  sectionCount: number;
  currentSectionIndex: number;
  setCurrentSectionIndex: Dispatch<SetStateAction<number>>;
};

/**
 * Mantém a seção atual do formulário no navegador e garante que o índice nunca
 * aponte para uma seção inexistente depois de uma atualização de dados.
 */
export function usePersistedWorkbenchSection({
  cycleId,
  enabled,
  sectionCount,
  currentSectionIndex,
  setCurrentSectionIndex,
}: Params) {
  const restoredCycleRef = useRef<string | null>(null);

  useEffect(() => {
    restoredCycleRef.current = null;
  }, [cycleId]);

  useEffect(() => {
    if (!enabled || !cycleId || sectionCount === 0) return;
    // Restaura a seção salva apenas uma vez por ciclo. Reexecutar a cada
    // atualização de dados (ex.: loadWorkbench após salvar) sobrescrevia o
    // avanço do usuário com o índice antigo ainda presente no localStorage.
    if (restoredCycleRef.current === cycleId) return;
    restoredCycleRef.current = cycleId;

    try {
      const raw = localStorage.getItem(sectionStorageKey(cycleId));
      if (raw == null) return;
      const storedIndex = Number.parseInt(raw, 10);
      if (Number.isFinite(storedIndex)) {
        setCurrentSectionIndex(Math.min(Math.max(0, storedIndex), sectionCount - 1));
      }
    } catch {
      // O preenchimento continua funcional quando o armazenamento local não está disponível.
    }
  }, [cycleId, enabled, sectionCount, setCurrentSectionIndex]);

  useEffect(() => {
    if (!enabled || !cycleId || sectionCount === 0) return;

    try {
      localStorage.setItem(sectionStorageKey(cycleId), String(currentSectionIndex));
    } catch {
      // Persistência local é complementar e não deve bloquear o formulário.
    }
  }, [cycleId, currentSectionIndex, enabled, sectionCount]);

  useEffect(() => {
    if (sectionCount > 0 && currentSectionIndex >= sectionCount) {
      setCurrentSectionIndex(sectionCount - 1);
    }
  }, [currentSectionIndex, sectionCount, setCurrentSectionIndex]);
}
