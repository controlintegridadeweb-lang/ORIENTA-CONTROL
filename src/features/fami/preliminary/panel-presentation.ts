import {
  canAutomaticallyCloseQuadrimester,
  canManuallyMaterializeQuadrimester,
  hasQuadrimesterStarted,
  hasTrackableImplementation,
  isQuadrimesterClosed,
  officialFamiAvailableForQuadrimester,
  quadrimesterPeriod,
  type PreliminaryCalculationKind,
  type Quadrimester,
} from "./domain";
import { formatPlatformDate, formatPlatformTime } from "@/shared/datetime/platform-date-time";

export function readPreliminaryApiError(raw: unknown, fallback: string): string {
  if (!raw || typeof raw !== "object") return fallback;
  const error = (raw as { error?: unknown }).error;
  return typeof error === "string" && error.trim() ? error.trim() : fallback;
}

export function quadrimesterDateRangeLabel(start: string, end: string): string {
  const startMonth = monthLabel(start);
  const endMonth = monthLabel(end);
  return startMonth && endMonth ? `${startMonth} a ${endMonth}` : `${start} a ${end}`;
}

function monthLabel(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(isoDate);
  if (!match) return null;
  const months = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const month = Number(match[2]);
  return months[month - 1] ?? null;
}

export function formatCutoffDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export type PreliminaryScoreView = {
  pointsObtained: number;
  pointsPossible: number;
  percentage: number;
  maturityLevel: number | null;
};

export function formatPreliminaryPercentage(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function formatPreliminaryScore(score: PreliminaryScoreView | null): string {
  if (!score) return "—";
  return score.maturityLevel == null
    ? "N/A"
    : `${formatPreliminaryPercentage(score.percentage)} · nível ${score.maturityLevel}`;
}

/** Último quadrimestre já materializado no recorte (Q3 > Q2 > Q1). */
export function selectLatestCheckpoint<T extends { quadrimester: Quadrimester }>(
  latestByPeriod: T[],
): T | null {
  if (latestByPeriod.length === 0) return null;
  return [...latestByPeriod].sort((left, right) => right.quadrimester - left.quadrimester)[0] ?? null;
}

export function quadrimesterAvailability(
  referenceYear: number,
  quadrimester: Quadrimester,
  now: Date = new Date(),
): {
  closed: boolean;
  started: boolean;
  periodLabel: string;
  rangeLabel: string;
  cutoffLabel: string;
  waitingLabel: string;
} {
  const period = quadrimesterPeriod(referenceYear, quadrimester);
  const cutoffLabel = formatCutoffDate(period.end);
  return {
    closed: isQuadrimesterClosed(referenceYear, quadrimester, now),
    started: hasQuadrimesterStarted(referenceYear, quadrimester, now),
    periodLabel: period.label,
    rangeLabel: quadrimesterDateRangeLabel(period.start, period.end),
    cutoffLabel,
    waitingLabel: `O período começa em ${formatCutoffDate(period.start)}.`,
  };
}

export type QuadrimesterRowKind =
  | "upcoming"
  | "not_implemented"
  | "open"
  | "open_calculated"
  | "completed";

export type QuadrimesterRowAction = "none" | "calculate" | "recalculate" | "view_details";

export type QuadrimesterCheckpointView = {
  percentage: number | null | undefined;
  calculatedAt: string;
  closedAt: string | null;
  calculationKind: PreliminaryCalculationKind;
};

export type QuadrimesterDisplay = {
  kind: QuadrimesterRowKind;
  percentage: number | null;
  action: QuadrimesterRowAction;
  reason: string | null;
  auxiliary: string | null;
};

function hasPersistedPercentage(checkpoint: QuadrimesterCheckpointView | null): boolean {
  return checkpoint != null && checkpoint.percentage != null;
}

/**
 * Situação da linha do acompanhamento quadrimestral.
 * O percentual só existe quando há cálculo persistido — nunca uma estimativa ao vivo.
 */
export function resolveQuadrimesterDisplay(input: {
  started: boolean;
  closed: boolean;
  officialAvailable: boolean;
  hasImplementation: boolean;
  checkpoint: QuadrimesterCheckpointView | null;
}): QuadrimesterDisplay {
  const closedSnapshot = Boolean(input.checkpoint?.closedAt);
  const persisted = hasPersistedPercentage(input.checkpoint);

  if (!input.started) {
    return {
      kind: "upcoming",
      percentage: null,
      action: "none",
      reason: null,
      auxiliary: null,
    };
  }

  if (closedSnapshot) {
    return {
      kind: "completed",
      percentage: input.checkpoint?.percentage ?? null,
      action: "view_details",
      reason: null,
      auxiliary: input.checkpoint?.closedAt
        ? formatPreliminaryClosedAt(input.checkpoint.closedAt)
        : null,
    };
  }

  if (!input.closed && persisted) {
    return {
      kind: "open_calculated",
      percentage: input.checkpoint?.percentage ?? null,
      action: "recalculate",
      reason: null,
      auxiliary: formatPreliminaryCalculatedAt(input.checkpoint?.calculatedAt),
    };
  }

  if (input.closed && persisted) {
    return {
      kind: "open_calculated",
      percentage: input.checkpoint?.percentage ?? null,
      action: "view_details",
      reason: null,
      auxiliary: "Aguardando fechamento automático.",
    };
  }

  if (!input.officialAvailable) {
    return {
      kind: "not_implemented",
      percentage: null,
      action: "none",
      reason: "Ainda não há Resultado FAMI oficial para servir de base a este quadrimestre.",
      auxiliary: null,
    };
  }

  if (!input.closed) {
    return {
      kind: "open",
      percentage: null,
      action: "calculate",
      reason: null,
      auxiliary: null,
    };
  }

  if (!input.hasImplementation) {
    return {
      kind: "not_implemented",
      percentage: null,
      action: "none",
      reason:
        "Ainda não há ações ou registros de Monitoramento suficientes para o acompanhamento.",
      auxiliary: null,
    };
  }

  return {
    kind: "open",
    percentage: null,
    action: "none",
    reason: null,
    auxiliary: "Aguardando fechamento automático.",
  };
}

export function buildQuadrimesterDisplay(input: {
  referenceYear: number;
  quadrimester: Quadrimester;
  officialAvailableAt: string | null | undefined;
  earliestActionCreatedAt: string | null | undefined;
  checkpoint: QuadrimesterCheckpointView | null;
  now?: Date;
}): QuadrimesterDisplay & {
  started: boolean;
  closed: boolean;
  officialAvailable: boolean;
  hasImplementation: boolean;
  canCalculateManually: boolean;
  canCloseAutomatically: boolean;
} {
  const now = input.now ?? new Date();
  const started = hasQuadrimesterStarted(input.referenceYear, input.quadrimester, now);
  const closed = isQuadrimesterClosed(input.referenceYear, input.quadrimester, now);
  const officialAvailable = officialFamiAvailableForQuadrimester({
    officialAvailableAt: input.officialAvailableAt,
    referenceYear: input.referenceYear,
    quadrimester: input.quadrimester,
    now,
  });
  const hasImplementation = hasTrackableImplementation({
    earliestActionCreatedAt: input.earliestActionCreatedAt,
    referenceYear: input.referenceYear,
    quadrimester: input.quadrimester,
    now,
  });
  const display = resolveQuadrimesterDisplay({
    started,
    closed,
    officialAvailable,
    hasImplementation,
    checkpoint: input.checkpoint,
  });
  return {
    ...display,
    started,
    closed,
    officialAvailable,
    hasImplementation,
    canCalculateManually: canManuallyMaterializeQuadrimester({
      started,
      closed,
      officialAvailable,
      hasClosedSnapshot: Boolean(input.checkpoint?.closedAt),
    }),
    canCloseAutomatically: canAutomaticallyCloseQuadrimester({
      closed,
      officialAvailable,
      hasImplementation,
      hasCheckpoint: input.checkpoint != null,
      hasClosedSnapshot: Boolean(input.checkpoint?.closedAt),
    }),
  };
}

export function formatPreliminaryCalculatedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = formatPlatformDate(iso, { day: "2-digit", month: "2-digit", year: "numeric" }, "");
  const time = formatPlatformTime(iso, { hour: "2-digit", minute: "2-digit" }, "");
  if (!date || !time) return null;
  return `Calculado em ${date} às ${time}`;
}

export function formatPreliminaryClosedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = formatPlatformDate(iso, { day: "2-digit", month: "2-digit", year: "numeric" }, "");
  if (!date) return null;
  return `Fechado automaticamente em ${date}`;
}

/**
 * FAMI preliminar na linha do quadrimestre: somente o cálculo persistido.
 * Sem checkpoint, a célula permanece "—" — o Resultado FAMI anual não preenche esta coluna.
 */
export function preliminaryPercentageForPeriod(input: {
  checkpointPercentage: number | null | undefined;
}): number | null {
  return input.checkpointPercentage ?? null;
}
