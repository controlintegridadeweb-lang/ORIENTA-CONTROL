/**
 * Preserva seleção em lote da fila ao navegar para o formulário completo.
 * Somente estado de UI — não altera decisões nem contadores.
 */

const selectionKey = (cycleId: string) =>
  `orienta:validation-queue:selection:${cycleId}`;

export type QueueBatchSelection = {
  evidenceIds: string[];
  naIds: string[];
  batchMode: boolean;
};

export function saveQueueBatchSelection(
  cycleId: string,
  selection: QueueBatchSelection,
): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      selectionKey(cycleId),
      JSON.stringify(selection),
    );
  } catch {
    // storage indisponível — navegação segue sem seleção
  }
}

export function loadQueueBatchSelection(
  cycleId: string,
): QueueBatchSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(selectionKey(cycleId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QueueBatchSelection;
    return {
      evidenceIds: Array.isArray(parsed.evidenceIds) ? parsed.evidenceIds : [],
      naIds: Array.isArray(parsed.naIds) ? parsed.naIds : [],
      batchMode: Boolean(parsed.batchMode),
    };
  } catch {
    return null;
  }
}

export function clearQueueBatchSelection(cycleId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(selectionKey(cycleId));
  } catch {
    // ignore
  }
}
