/** Exercício em que o resultado oficial sai só no fechamento do diagnóstico. */
export const INTERIM_MONITORING_EXCLUDED_YEAR = 2026;

export const INTERIM_MONITORING_EXCLUDED_CODE = "interim_monitoring_excluded_for_exercise";

export const INTERIM_MONITORING_EXCLUDED_MESSAGE =
  "Em 2026 não há relatório de monitoramento nem FAMI preliminar. O resultado oficial é calculado uma única vez no fechamento do diagnóstico.";

export function exerciseAllowsInterimMonitoring(referenceYear: number): boolean {
  return referenceYear !== INTERIM_MONITORING_EXCLUDED_YEAR;
}

export class InterimExerciseExcludedError extends Error {
  readonly code = INTERIM_MONITORING_EXCLUDED_CODE;

  constructor() {
    super(INTERIM_MONITORING_EXCLUDED_CODE);
    this.name = "InterimExerciseExcludedError";
  }
}

export function assertInterimMonitoringAllowed(referenceYear: number): void {
  if (!exerciseAllowsInterimMonitoring(referenceYear)) {
    throw new InterimExerciseExcludedError();
  }
}
