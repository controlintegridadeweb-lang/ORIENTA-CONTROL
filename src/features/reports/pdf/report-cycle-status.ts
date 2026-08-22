import { cycleStateLabelOrFallback } from "@/shared/domain/cycle-labels";

/**
 * Rótulo do estado efetivo do diagnóstico exibido no relatório oficial.
 *
 * O processamento FAMI pode permanecer oficial mesmo quando um diagnóstico é
 * reaberto. Por isso o relatório deve usar o estado do ciclo, não inferi-lo a
 * partir da existência de um score oficial.
 */
export function reportCycleStateLabel(cycleState: string | null | undefined): string {
  return cycleStateLabelOrFallback(cycleState);
}
