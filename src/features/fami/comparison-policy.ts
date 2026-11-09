/**
 * Regras dos três comparativos do FAMI.
 * A diferença global usa percentuais oficiais congelados.
 * A evolução estrita exige formulário, órgão, política e base compatíveis.
 */

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

/** Diferença global: percentual oficial atual menos o anterior, em pontos percentuais. */
export function globalPercentagePointDelta(
  current: number | null,
  previous: number | null,
): number | null {
  if (current == null || previous == null) return null;
  return Math.round((current - previous) * 10) / 10;
}

export function formatPercentagePoints(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  const digits = Number.isInteger(delta) ? delta.toFixed(0) : delta.toFixed(1);
  return `${sign}${digits} pontos percentuais`;
}

export type QuestionMeasure = {
  questionId: string;
  prompt: string;
  evidenceRequired: boolean;
  famiEnabled: boolean;
  axisId: string;
};

export function questionsCorrespond(left: QuestionMeasure, right: QuestionMeasure): boolean {
  return (
    left.questionId === right.questionId &&
    left.prompt.trim() === right.prompt.trim() &&
    left.evidenceRequired === right.evidenceRequired &&
    left.famiEnabled === right.famiEnabled &&
    left.axisId === right.axisId
  );
}

function officialQuestions(measures: readonly QuestionMeasure[]): QuestionMeasure[] {
  return measures.filter((measure) => measure.famiEnabled);
}

/** Base compatível: o mesmo conjunto de perguntas que entra no percentual, medindo a mesma coisa. */
export function criteriaBaseCompatible(
  left: readonly QuestionMeasure[],
  right: readonly QuestionMeasure[],
): boolean {
  const leftOfficial = officialQuestions(left);
  const rightOfficial = officialQuestions(right);
  if (leftOfficial.length !== rightOfficial.length) return false;
  const rightById = new Map(rightOfficial.map((measure) => [measure.questionId, measure]));
  return leftOfficial.every((measure) => {
    const match = rightById.get(measure.questionId);
    return match != null && questionsCorrespond(measure, match);
  });
}

export function isStrictEvolution(input: {
  sameForm: boolean;
  sameOrganization: boolean;
  samePolicy: boolean;
  compatibleBase: boolean;
}): boolean {
  return input.sameForm && input.sameOrganization && input.samePolicy && input.compatibleBase;
}

export type OfficialDiagnosticCandidate = {
  cycleId: string;
  completedAt: string | null;
};

function completedAtRank(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

/** completed_at mais recente; empate de instante resolve pelo menor cycle_id. */
export function compareOfficialDiagnostics(
  left: OfficialDiagnosticCandidate,
  right: OfficialDiagnosticCandidate,
): number {
  const byTime = completedAtRank(right.completedAt) - completedAtRank(left.completedAt);
  if (byTime !== 0) return byTime;
  if (left.cycleId < right.cycleId) return -1;
  if (left.cycleId > right.cycleId) return 1;
  return 0;
}

export function selectOfficialDiagnostic<T extends OfficialDiagnosticCandidate>(
  candidates: readonly T[],
): T | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort(compareOfficialDiagnostics)[0] ?? null;
}
