import type {
  ReportCycleOption,
  ReportHistoryOption,
} from "@/features/reports/ui/client";
import {
  adminReportsPath,
  parseReportCatalogKind,
  type ReportCatalogKindParam,
} from "@/shared/navigation/report-paths";

export const REPORT_HISTORY_PAGE_SIZE = 25;
export const REPORT_CYCLE_PAGE_SIZE = 25;

export type ReportsState = {
  organizations: { id: string; name: string }[];
  cycles: ReportCycleOption[];
  cycleSearch: string;
  cycleOffset: number;
  cycleTotal: number;
  cycleHasMore: boolean;
  history: ReportHistoryOption[];
  historyTotal: number;
  historyOffset: number;
  historyHasMore: boolean;
  organizationId: string;
  cycleId: string;
  historyKind: "" | "annual" | "bimonthly";
  loadingScopes: boolean;
  loadingCycles: boolean;
  loadingHistory: boolean;
  scopeError: string | null;
  cyclesError: string | null;
  historyError: string | null;
  generating: boolean;
  reissueReason: string;
};

export type ReportsPatch = (patch: Partial<ReportsState>) => void;

type ReportsAction = { type: "patch"; patch: Partial<ReportsState> };

export function reportsReducer(state: ReportsState, action: ReportsAction): ReportsState {
  return action.type === "patch" ? { ...state, ...action.patch } : state;
}

export function createInitialReportsState({
  initialOrganizationId,
  initialCycleId,
  initialHistoryOffset,
  initialHistoryKind = "",
}: {
  initialOrganizationId: string | null;
  initialCycleId: string | null;
  initialHistoryOffset: number;
  initialHistoryKind?: "" | "annual" | "bimonthly";
}): ReportsState {
  return {
    organizations: [],
    cycles: [],
    cycleSearch: "",
    cycleOffset: 0,
    cycleTotal: 0,
    cycleHasMore: false,
    history: [],
    historyTotal: 0,
    historyOffset: initialHistoryOffset,
    historyHasMore: false,
    organizationId: initialOrganizationId ?? "",
    cycleId: initialCycleId ?? "",
    historyKind: initialHistoryKind,
    loadingScopes: true,
    loadingCycles: false,
    loadingHistory: false,
    scopeError: null,
    cyclesError: null,
    historyError: null,
    generating: false,
    reissueReason: "",
  };
}

export function reportsHref(
  organizationId: string,
  cycleId: string,
  offset: number,
  kind: ReportCatalogKindParam | "" = "",
): string {
  return adminReportsPath({ organizationId, cycleId, offset, kind });
}

export function reportKindFromSearchParams(
  searchParams: { get(name: string): string | null },
): ReportCatalogKindParam | "" {
  return parseReportCatalogKind(searchParams.get("kind"));
}

export function reportOffsetFromSearchParams(
  searchParams: { get(name: string): string | null },
): number {
  const value = Number(searchParams.get("offset") ?? "0");
  return Number.isInteger(value) && value > 0 ? value : 0;
}
