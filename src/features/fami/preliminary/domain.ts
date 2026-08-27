import { levelForPercentage } from "@/shared/domain/fami-policy";
import {
  happenedAtOrBefore,
  isQuadrimesterClosed,
  quadrimesterLastInstant,
  type Quadrimester,
} from "@/shared/domain/calendar-periods";
import {
  evaluateCriterionCompletion,
  type ActionCompletionSnapshot,
} from "@/shared/domain/criterion-completion";
import { FAMI_PRELIMINARY_METHODOLOGY_V2 } from "./methodology";

export {
  FAMI_PRELIMINARY_METHODOLOGY_V1,
  FAMI_PRELIMINARY_METHODOLOGY_V2,
  FAMI_PRELIMINARY_METHODOLOGY_VERSIONS,
  type FamiPreliminaryMethodologyVersion,
} from "./methodology";

export {
  bimesterClosesQuadrimester,
  bimesterCutoffExclusive,
  bimesterLastInstant,
  bimesterPeriod,
  bimestersOfQuadrimester,
  BIMESTERS,
  hasBimesterStarted,
  hasQuadrimesterStarted,
  happenedAtOrBefore,
  isBimesterClosed,
  isQuadrimesterClosed,
  periodCutoffExclusive,
  periodLastInstant,
  quadrimesterClosedByBimester,
  quadrimesterContainingBimester,
  quadrimesterCutoffExclusive,
  quadrimesterLastInstant,
  quadrimesterPeriod,
  QUADRIMESTERS,
  type Bimester,
  type Quadrimester,
} from "@/shared/domain/calendar-periods";

export type PreliminaryCriterionInput = {
  officialPoints: number;
  pointsPossible: number;
  activeActionProgressPercentages: number[];
  hasApprovedException: boolean;
  hasRecommendation: boolean;
};

export type PreliminaryCriterionV2Input = {
  officialPoints: number;
  pointsPossible: number;
  hasRecommendation: boolean;
  hasApprovedException: boolean;
  actions: readonly ActionCompletionSnapshot[];
  activeActionProgressPercentages?: number[];
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

export type PreliminaryCriterionV2Result = PreliminaryCriterionResult & {
  criterionCompleted: boolean;
  completedActionCount: number;
  methodologyVersion: typeof FAMI_PRELIMINARY_METHODOLOGY_V2;
};

export type PreliminaryAggregate = {
  pointsObtained: number;
  pointsPossible: number;
  percentage: number;
  maturityLevel: 1 | 2 | 3 | 4 | 5 | null;
};

export function roundPreliminary(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function averageProgress(percentages: readonly number[]): number {
  if (percentages.length === 0) return 0;
  return roundPreliminary(
    percentages.map(clampProgress).reduce((sum, value) => sum + value, 0) / percentages.length,
    4,
  );
}

function baseCriterionScore(input: {
  officialPoints: number;
  pointsPossible: number;
}): Pick<PreliminaryCriterionResult, "officialPoints" | "pointsPossible" | "recoverableGap"> {
  const possible = Math.max(0, input.pointsPossible);
  const official = Math.min(possible, Math.max(0, input.officialPoints));
  return {
    officialPoints: roundPreliminary(official, 4),
    pointsPossible: roundPreliminary(possible, 4),
    recoverableGap: roundPreliminary(possible - official, 4),
  };
}

function capPreliminary(
  official: number,
  recovered: number,
  possible: number,
): { recoveredPoints: number; preliminaryPoints: number } {
  const recoveredPoints = roundPreliminary(Math.min(Math.max(0, recovered), possible - official), 4);
  return {
    recoveredPoints,
    preliminaryPoints: roundPreliminary(Math.min(possible, official + recoveredPoints), 4),
  };
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
  const base = baseCriterionScore(input);
  const progresses = input.activeActionProgressPercentages.map(clampProgress);
  const canRecover =
    input.hasRecommendation && !input.hasApprovedException && progresses.length > 0;
  const progress = canRecover ? averageProgress(progresses) : 0;
  const recovered = roundPreliminary(base.recoverableGap * (progress / 100), 4);
  const capped = capPreliminary(base.officialPoints, recovered, base.pointsPossible);

  return {
    ...base,
    activeActionCount: canRecover ? progresses.length : 0,
    actionProgressPercentage: progress,
    ...capped,
  };
}

/**
 * Metodologia prelim_v2.
 *
 * Percentual de progresso não gera pontos. A recuperação do gap é integral e
 * só ocorre quando o critério está efetivamente concluído e aceito na data de
 * corte. O percentual continua disponível para monitoramento.
 */
export function calculatePreliminaryCriterionV2(
  input: PreliminaryCriterionV2Input,
): PreliminaryCriterionV2Result {
  const base = baseCriterionScore(input);
  const completion = evaluateCriterionCompletion({
    hasRecommendation: input.hasRecommendation,
    hasApprovedException: input.hasApprovedException,
    actions: input.actions,
  });
  const progress = averageProgress(input.activeActionProgressPercentages ?? []);
  const recovered = completion.criterionCompleted ? base.recoverableGap : 0;
  const capped = capPreliminary(base.officialPoints, recovered, base.pointsPossible);

  return {
    ...base,
    activeActionCount: completion.activeActionCount,
    actionProgressPercentage: progress,
    ...capped,
    criterionCompleted: completion.criterionCompleted,
    completedActionCount: completion.completedActionCount,
    methodologyVersion: FAMI_PRELIMINARY_METHODOLOGY_V2,
  };
}

export function aggregatePreliminaryCriteria(
  criteria: Array<Pick<PreliminaryCriterionResult, "preliminaryPoints" | "pointsPossible">>,
): PreliminaryAggregate {
  const pointsObtained = roundPreliminary(
    criteria.reduce((sum, item) => sum + item.preliminaryPoints, 0),
    2,
  );
  const pointsPossible = roundPreliminary(
    criteria.reduce((sum, item) => sum + item.pointsPossible, 0),
    2,
  );
  if (pointsPossible === 0) {
    return { pointsObtained: 0, pointsPossible: 0, percentage: 0, maturityLevel: null };
  }
  const percentage = roundPreliminary((pointsObtained / pointsPossible) * 100, 2);
  return {
    pointsObtained,
    pointsPossible,
    percentage,
    maturityLevel: levelForPercentage(percentage),
  };
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

export function canAutomaticallyCloseBimester(input: {
  closed: boolean;
  officialAvailable: boolean;
  hasImplementation: boolean;
  hasCheckpoint: boolean;
  hasClosedSnapshot: boolean;
}): boolean {
  return canAutomaticallyCloseQuadrimester(input);
}

export function canManuallyMaterializeBimester(input: {
  started: boolean;
  closed: boolean;
  officialAvailable: boolean;
  hasClosedSnapshot: boolean;
}): boolean {
  return canManuallyMaterializeQuadrimester(input);
}
