import { levelForPercentage } from "@/shared/domain/fami-policy";

export const FAMI_PRELIMINARY_METHODOLOGY_VERSION = "prelim_v1" as const;

export type Quadrimester = 1 | 2 | 3;

export type PreliminaryCriterionInput = {
  officialPoints: number;
  pointsPossible: number;
  activeActionProgressPercentages: number[];
  hasApprovedException: boolean;
  hasRecommendation: boolean;
};

export type PreliminaryCriterionResult = {
  officialPoints: number;
  pointsPossible: number;
  recoverableGap: number;
  activeActionCount: number;
  actionProgressPercentage: number;
  recoveredPoints: number;
  preliminaryPoints: number;
};

export type PreliminaryAggregate = {
  pointsObtained: number;
  pointsPossible: number;
  percentage: number;
  maturityLevel: 1 | 2 | 3 | 4 | 5 | null;
};

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * Metodologia prelim_v1.
 *
 * O diagnóstico oficial é a base imutável. O plano só pode recuperar o gap que
 * faltava no critério oficial e somente quando existe recomendação. A média usa
 * exclusivamente ações ativas; canceladas já chegam excluídas do vetor.
 */
export function calculatePreliminaryCriterion(
  input: PreliminaryCriterionInput,
): PreliminaryCriterionResult {
  const possible = Math.max(0, input.pointsPossible);
  const official = Math.min(possible, Math.max(0, input.officialPoints));
  const recoverableGap = round(possible - official, 4);

  const progresses = input.activeActionProgressPercentages.map(clampProgress);
  const canRecover =
    input.hasRecommendation && !input.hasApprovedException && progresses.length > 0;
  const progress = canRecover
    ? round(progresses.reduce((sum, value) => sum + value, 0) / progresses.length, 4)
    : 0;
  const recovered = round(recoverableGap * (progress / 100), 4);

  return {
    officialPoints: round(official, 4),
    pointsPossible: round(possible, 4),
    recoverableGap,
    activeActionCount: canRecover ? progresses.length : 0,
    actionProgressPercentage: progress,
    recoveredPoints: recovered,
    preliminaryPoints: round(official + recovered, 4),
  };
}

export function aggregatePreliminaryCriteria(
  criteria: Array<Pick<PreliminaryCriterionResult, "preliminaryPoints" | "pointsPossible">>,
): PreliminaryAggregate {
  const pointsObtained = round(
    criteria.reduce((sum, item) => sum + item.preliminaryPoints, 0),
    2,
  );
  const pointsPossible = round(
    criteria.reduce((sum, item) => sum + item.pointsPossible, 0),
    2,
  );
  if (pointsPossible === 0) {
    return { pointsObtained: 0, pointsPossible: 0, percentage: 0, maturityLevel: null };
  }
  const percentage = round((pointsObtained / pointsPossible) * 100, 2);
  return {
    pointsObtained,
    pointsPossible,
    percentage,
    maturityLevel: levelForPercentage(percentage),
  };
}

export function quadrimesterPeriod(referenceYear: number, quadrimester: Quadrimester): {
  start: string;
  end: string;
  label: string;
} {
  if (!Number.isInteger(referenceYear) || referenceYear < 1900 || referenceYear > 2100) {
    throw new Error("invalid_preliminary_reference_year");
  }
  const ranges = {
    1: [`${referenceYear}-01-01`, `${referenceYear}-04-30`, "1º quadrimestre"],
    2: [`${referenceYear}-05-01`, `${referenceYear}-08-31`, "2º quadrimestre"],
    3: [`${referenceYear}-09-01`, `${referenceYear}-12-31`, "3º quadrimestre"],
  } as const;
  const [start, end, label] = ranges[quadrimester];
  return { start, end, label };
}

export function quadrimesterLastInstant(
  referenceYear: number,
  quadrimester: Quadrimester,
): Date {
  const { end } = quadrimesterPeriod(referenceYear, quadrimester);
  return new Date(`${end}T23:59:59.999-03:00`);
}

/** Primeiro instante após a data de corte, no horário de Fortaleza. */
export function quadrimesterCutoffExclusive(
  referenceYear: number,
  quadrimester: Quadrimester,
): Date {
  return new Date(quadrimesterLastInstant(referenceYear, quadrimester).getTime() + 1);
}

/** Disponível no dia seguinte à data de corte, no horário de Fortaleza. */
export function isQuadrimesterClosed(
  referenceYear: number,
  quadrimester: Quadrimester,
  now: Date = new Date(),
): boolean {
  return now.getTime() > quadrimesterLastInstant(referenceYear, quadrimester).getTime();
}

export function hasQuadrimesterStarted(
  referenceYear: number,
  quadrimester: Quadrimester,
  now: Date = new Date(),
): boolean {
  const { start } = quadrimesterPeriod(referenceYear, quadrimester);
  const firstInstant = new Date(`${start}T00:00:00.000-03:00`);
  return now.getTime() >= firstInstant.getTime();
}

export function happenedAtOrBefore(
  timestamp: string | null | undefined,
  limit: Date,
): boolean {
  if (!timestamp) return false;
  const instant = new Date(timestamp);
  if (Number.isNaN(instant.getTime())) return false;
  return instant.getTime() <= limit.getTime();
}

/**
 * Durante o período aberto, a base oficial vale se já existir.
 * Após o corte, só vale o Resultado FAMI que já existia na data de corte.
 */
export function officialFamiAvailableForQuadrimester(input: {
  officialAvailableAt: string | null | undefined;
  referenceYear: number;
  quadrimester: Quadrimester;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  if (!input.officialAvailableAt) return false;
  const limit = isQuadrimesterClosed(input.referenceYear, input.quadrimester, now)
    ? quadrimesterLastInstant(input.referenceYear, input.quadrimester)
    : now;
  return happenedAtOrBefore(input.officialAvailableAt, limit);
}

/** True se o Resultado FAMI oficial já existia na data de corte do quadrimestre. */
export function officialFamiAvailableAtCutoff(
  officialAvailableAt: string | null | undefined,
  periodEnd: string,
): boolean {
  if (!officialAvailableAt) return false;
  const lastInstant = new Date(`${periodEnd}T23:59:59.999-03:00`);
  return new Date(officialAvailableAt).getTime() <= lastInstant.getTime();
}

export function hasTrackableImplementation(input: {
  earliestActionCreatedAt: string | null | undefined;
  referenceYear: number;
  quadrimester: Quadrimester;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  const limit = isQuadrimesterClosed(input.referenceYear, input.quadrimester, now)
    ? quadrimesterLastInstant(input.referenceYear, input.quadrimester)
    : now;
  return happenedAtOrBefore(input.earliestActionCreatedAt, limit);
}

export type PreliminaryCalculationKind = "manual" | "automatic";

/**
 * Fechamento automático só consolida período vencido com base oficial e
 * alguma execução (ação/monitoramento ou prévia manual). Sem isso, permanece
 * "Não implementado".
 */
export function canAutomaticallyCloseQuadrimester(input: {
  closed: boolean;
  officialAvailable: boolean;
  hasImplementation: boolean;
  hasCheckpoint: boolean;
  hasClosedSnapshot: boolean;
}): boolean {
  if (!input.closed || input.hasClosedSnapshot) return false;
  if (!input.officialAvailable) return false;
  return input.hasImplementation || input.hasCheckpoint;
}

export function canManuallyMaterializeQuadrimester(input: {
  started: boolean;
  closed: boolean;
  officialAvailable: boolean;
  hasClosedSnapshot: boolean;
}): boolean {
  if (!input.started || input.closed || input.hasClosedSnapshot) return false;
  return input.officialAvailable;
}
