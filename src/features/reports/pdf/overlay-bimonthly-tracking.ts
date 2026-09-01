import {
  computeActionSla,
  parseResponsibleLabel,
  planStatusFromDb,
  type ActionPlanAction,
  type ActionPlanByCyclePayload,
  type ActionPlanRecommendationNode,
  type DbActionPlanStatus,
} from "@/features/improvement-management";
import { formatPlatformDate } from "@/shared/datetime/platform-date-time";
import {
  bimesterPeriod,
  happenedAtOrBefore,
  periodLastInstant,
} from "@/shared/domain/calendar-periods";
import type { OfficialReportData, ReportActionMovementSource } from "./report-types";

export const BIMONTHLY_TRACKING_DISCLAIMER =
  "Fotografia do plano de integridade e compliance no corte do bimestre.";

export const BIMONTHLY_TRACKING_OFFICIAL_BASE_MISSING =
  "bimonthly_tracking_official_base_missing";

export type BimonthlyTrackingActionSnapshot = {
  actionPlanId: string;
  recommendationId: string;
  axisId: string;
  axisName: string;
  sectionName: string;
  questionPrompt: string;
  recommendationText: string;
  actionText: string;
  responsibleLabel: string;
  startDate: string;
  dueDate: string;
  status: DbActionPlanStatus;
  progressPercentage: number;
  revision: number;
  effectiveAt: string;
  overdue: boolean;
};

export type BimonthlyTrackingSnapshot = {
  cycleId: string;
  referenceYear: number;
  bimester: 1 | 2 | 3 | 4 | 5 | 6;
  reportVersion: number;
  generationKind: "manual" | "automatic";
  generatedAt: string;
  periodEnd: string;
  actions: BimonthlyTrackingActionSnapshot[];
};

function overlayDocuments(
  live: ActionPlanAction | null,
  snap: BimonthlyTrackingActionSnapshot,
  cutoff: Date,
): ActionPlanAction["documents"] {
  return (live?.documents ?? [])
    .filter((document) => {
      if (document.actionRevision > snap.revision) return false;
      if (!document.createdAt) return true;
      return happenedAtOrBefore(document.createdAt, cutoff);
    })
    .map((document) => ({
      ...document,
      isCurrentRevision: document.actionRevision === snap.revision,
    }));
}

function actionFromSnapshot(
  snap: BimonthlyTrackingActionSnapshot,
  live: ActionPlanAction | null,
  cutoff: Date,
): ActionPlanAction {
  const status = planStatusFromDb(snap.status);
  const { sector, name } = parseResponsibleLabel(snap.responsibleLabel);
  return {
    id: snap.actionPlanId,
    actionText: snap.actionText,
    startDate: snap.startDate,
    dueDate: snap.dueDate,
    responsibleSector: sector || live?.responsibleSector || "",
    responsibleUserId: live?.responsibleUserId ?? null,
    responsibleName: name || live?.responsibleName || "",
    progressPercentage: snap.progressPercentage,
    status,
    observations: live?.observations ?? null,
    updatedAt: snap.effectiveAt,
    revision: snap.revision,
    documents: overlayDocuments(live, snap, cutoff),
    slaLabel: snap.overdue
      ? "overdue"
      : computeActionSla({ dueDate: snap.dueDate, status }, cutoff),
  };
}

function summarizeActionPlan(axes: ActionPlanByCyclePayload["axes"]): ActionPlanByCyclePayload["summary"] {
  const actionsByStatus: ActionPlanByCyclePayload["summary"]["actionsByStatus"] = {};
  let totalActions = 0;
  let recommendationsWithActions = 0;
  let totalRecommendations = 0;
  for (const axis of axes) {
    for (const recommendation of axis.recommendations) {
      totalRecommendations += 1;
      if (recommendation.actions.length > 0) recommendationsWithActions += 1;
      for (const action of recommendation.actions) {
        totalActions += 1;
        actionsByStatus[action.status] = (actionsByStatus[action.status] ?? 0) + 1;
      }
    }
  }
  return {
    totalRecommendations,
    recommendationsWithActions,
    totalActions,
    actionsByStatus,
  };
}

function overlayRecommendation(
  recommendation: ActionPlanRecommendationNode,
  snaps: BimonthlyTrackingActionSnapshot[],
  cutoff: Date,
): ActionPlanRecommendationNode {
  const liveById = new Map(recommendation.actions.map((action) => [action.id, action]));
  return {
    ...recommendation,
    actions: snaps.map((snap) =>
      actionFromSnapshot(snap, liveById.get(snap.actionPlanId) ?? null, cutoff),
    ),
  };
}

function syntheticRecommendation(
  snaps: BimonthlyTrackingActionSnapshot[],
  cutoff: Date,
): ActionPlanRecommendationNode {
  const first = snaps[0]!;
  return {
    recommendationId: first.recommendationId,
    recommendationText: first.recommendationText,
    recommendationType: "nao_implementacao",
    recommendationStatus: "in_action_plan",
    questionPrompt: first.questionPrompt,
    sectionName: first.sectionName,
    actions: snaps.map((snap) => actionFromSnapshot(snap, null, cutoff)),
  };
}

function overlayActionPlan(
  actionPlan: ActionPlanByCyclePayload,
  snapshots: BimonthlyTrackingActionSnapshot[],
  cutoff: Date,
): ActionPlanByCyclePayload {
  const snapsByRecommendation = new Map<string, BimonthlyTrackingActionSnapshot[]>();
  for (const snap of snapshots) {
    const list = snapsByRecommendation.get(snap.recommendationId) ?? [];
    list.push(snap);
    snapsByRecommendation.set(snap.recommendationId, list);
  }

  const seenRecommendations = new Set<string>();
  const axes = actionPlan.axes.map((axis) => ({
    ...axis,
    recommendations: axis.recommendations.map((recommendation) => {
      seenRecommendations.add(recommendation.recommendationId);
      return overlayRecommendation(
        recommendation,
        snapsByRecommendation.get(recommendation.recommendationId) ?? [],
        cutoff,
      );
    }),
  }));

  for (const [recommendationId, snaps] of snapsByRecommendation) {
    if (seenRecommendations.has(recommendationId)) continue;
    const axisId = snaps[0]?.axisId ?? "";
    let axis = axes.find((candidate) => candidate.axisId === axisId);
    if (!axis) {
      axis = {
        axisId,
        axisName: snaps[0]?.axisName || "(sem eixo)",
        recommendations: [],
      };
      axes.push(axis);
    }
    axis.recommendations.push(syntheticRecommendation(snaps, cutoff));
  }

  return {
    ...actionPlan,
    axes,
    summary: summarizeActionPlan(axes),
  };
}

function overlayMovements(
  movements: Record<string, ReportActionMovementSource[]>,
  cutoff: Date,
): Record<string, ReportActionMovementSource[]> {
  const next: Record<string, ReportActionMovementSource[]> = {};
  for (const [actionId, list] of Object.entries(movements)) {
    next[actionId] = list.filter((movement) =>
      happenedAtOrBefore(movement.createdAt, cutoff),
    );
  }
  return next;
}

export function overlayBimonthlyTrackingOnOfficialReport(
  data: OfficialReportData,
  snapshot: BimonthlyTrackingSnapshot,
): OfficialReportData {
  const cutoff = periodLastInstant(snapshot.periodEnd);
  const period = bimesterPeriod(snapshot.referenceYear, snapshot.bimester);
  return {
    ...data,
    generatedAtIso: snapshot.generatedAt,
    actionPlan: overlayActionPlan(data.actionPlan, snapshot.actions, cutoff),
    actionMovementsByActionId: overlayMovements(data.actionMovementsByActionId, cutoff),
    tracking: {
      kind: "bimonthly",
      bimester: snapshot.bimester,
      bimesterLabel: period.label,
      periodRangeLabel: period.shortLabel,
      cutoffLabel: formatPlatformDate(snapshot.periodEnd, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      reportVersion: snapshot.reportVersion,
      generationKind: snapshot.generationKind,
      disclaimer: BIMONTHLY_TRACKING_DISCLAIMER,
    },
  };
}
