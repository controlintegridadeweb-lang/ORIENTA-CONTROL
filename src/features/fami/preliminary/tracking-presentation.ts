import { famiPreliminaryLabels } from "@/shared/labels/official-labels";
import {
  BIMESTERS,
  bimesterPeriod,
  canManuallyMaterializeBimester,
  hasBimesterStarted,
  isBimesterClosed,
  officialFamiAvailableForQuadrimester,
  quadrimesterContainingBimester,
  type Bimester,
  type Quadrimester,
} from "@/features/fami/preliminary/domain";
import { formatCutoffDate, quadrimesterDateRangeLabel } from "./panel-presentation";

export type BimesterRowView = {
  bimester: Bimester;
  label: string;
  shortLabel: string;
  rangeLabel: string;
  cutoffLabel: string;
  started: boolean;
  closed: boolean;
  closesQuadrimester: boolean;
  quadrimester: Quadrimester | null;
  canGenerateManually: boolean;
};

export function buildBimesterRowView(
  referenceYear: number,
  bimester: Bimester,
  input: {
    officialAvailableAt: string | null | undefined;
    hasClosedSnapshot: boolean;
    now?: Date;
  },
): BimesterRowView {
  const now = input.now ?? new Date();
  const period = bimesterPeriod(referenceYear, bimester);
  const started = hasBimesterStarted(referenceYear, bimester, now);
  const closed = isBimesterClosed(referenceYear, bimester, now);
  const officialAvailable = officialFamiAvailableForQuadrimester({
    officialAvailableAt: input.officialAvailableAt,
    referenceYear,
    quadrimester: quadrimesterContainingBimester(bimester),
    now,
  });
  return {
    bimester,
    label: period.label,
    shortLabel: period.shortLabel,
    rangeLabel: quadrimesterDateRangeLabel(period.start, period.end),
    cutoffLabel: formatCutoffDate(period.end),
    started,
    closed,
    closesQuadrimester: period.closesQuadrimester,
    quadrimester: period.quadrimester,
    canGenerateManually: canManuallyMaterializeBimester({
      started,
      closed,
      officialAvailable,
      hasClosedSnapshot: input.hasClosedSnapshot,
    }),
  };
}

export function listBimesterRows(
  referenceYear: number,
  input: {
    officialAvailableAt: string | null | undefined;
    closedBimesters: ReadonlySet<Bimester>;
    now?: Date;
  },
): BimesterRowView[] {
  return BIMESTERS.map((bimester) =>
    buildBimesterRowView(referenceYear, bimester, {
      officialAvailableAt: input.officialAvailableAt,
      hasClosedSnapshot: input.closedBimesters.has(bimester),
      now: input.now,
    }),
  );
}

export function bimesterRowStatus(
  row: BimesterRowView,
  hasReport: boolean,
): { label: string; auxiliary: string | null } {
  if (!row.started) {
    return { label: famiPreliminaryLabels.statusUpcoming, auxiliary: null };
  }
  if (hasReport) {
    return {
      label: famiPreliminaryLabels.bimonthlyReportAvailable,
      auxiliary: row.closed ? famiPreliminaryLabels.statusCompleted : null,
    };
  }
  if (row.closed) {
    return {
      label: famiPreliminaryLabels.statusNotImplemented,
      auxiliary: "Aguardando fechamento automático.",
    };
  }
  return { label: famiPreliminaryLabels.bimonthlyReportPending, auxiliary: null };
}

export function formatBimesterSummary(input: {
  completedCriterionCount: number;
  pendingCriterionCount: number;
  averageProgressPercentage: number;
} | null): string {
  if (!input) return "—";
  const progress = input.averageProgressPercentage.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${input.completedCriterionCount} critérios concluídos · ${input.pendingCriterionCount} pendentes · média ${progress}%`;
}
