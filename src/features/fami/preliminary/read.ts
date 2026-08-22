import "server-only";

import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";
import type { Quadrimester } from "./domain";

export type PreliminaryCheckpoint = {
  id: string;
  cycleId: string;
  referenceYear: number;
  quadrimester: Quadrimester;
  calculationVersion: number;
  methodologyVersion: string;
  calculationKind: "manual" | "automatic";
  calculatedBy: string | null;
  periodStart: string;
  periodEnd: string;
  calculatedAt: string;
  closedAt: string | null;
  sourceProcessingVersion: number;
  sourcePolicyVersion: string;
  official: {
    pointsObtained: number;
    pointsPossible: number;
    percentage: number;
    maturityLevel: number | null;
  } | null;
  preliminary: {
    pointsObtained: number;
    pointsPossible: number;
    percentage: number;
    maturityLevel: number | null;
  } | null;
  deltaPercentagePoints: number | null;
};

export type PreliminaryTrackingContext = {
  officialAvailableAt: string | null;
  earliestActionCreatedAt: string | null;
};

export type PreliminaryHistory = {
  history: PreliminaryCheckpoint[];
  latestByPeriod: PreliminaryCheckpoint[];
  tracking: PreliminaryTrackingContext;
};

export async function listPreliminaryCheckpoints(
  client: TypedSupabaseClient,
  cycleId: string,
  referenceYear?: number,
): Promise<PreliminaryHistory> {
  let query = client
    .from("fami_preliminary_processings")
    .select(
      "id, cycle_id, reference_year, quadrimester, calculation_version, methodology_version, calculation_kind, calculated_by, period_start, period_end, calculated_at, closed_at, source_cycle_processing_id, source_processing_version, source_policy_version",
    )
    .eq("cycle_id", cycleId)
    .order("reference_year", { ascending: false })
    .order("quadrimester", { ascending: false })
    .order("calculation_version", { ascending: false });
  if (referenceYear != null) query = query.eq("reference_year", referenceYear);

  const { data: processings, error: processingError } = await query;
  if (processingError) throw processingError;

  const tracking = await loadPreliminaryTracking(client, cycleId);
  if (!processings?.length) {
    return { history: [], latestByPeriod: [], tracking };
  }

  const preliminaryIds = processings.map((row) => row.id);
  const sourceIds = Array.from(
    new Set(processings.map((row) => row.source_cycle_processing_id)),
  );

  const [preliminaryResult, officialResult] = await Promise.all([
    client
      .from("fami_preliminary_results")
      .select(
        "preliminary_processing_id,points_obtained,points_possible,percentage,maturity_level",
      )
      .in("preliminary_processing_id", preliminaryIds)
      .eq("scope_type", "global"),
    client
      .from("fami_results")
      .select(
        "cycle_processing_id,points_obtained,points_possible,percentage,maturity_level",
      )
      .in("cycle_processing_id", sourceIds)
      .eq("scope_type", "global"),
  ]);
  if (preliminaryResult.error) throw preliminaryResult.error;
  if (officialResult.error) throw officialResult.error;

  const prelimById = new Map(
    (preliminaryResult.data ?? []).map((row) => [row.preliminary_processing_id, row]),
  );
  const officialById = new Map(
    (officialResult.data ?? []).map((row) => [row.cycle_processing_id, row]),
  );

  const history: PreliminaryCheckpoint[] = processings.map((row) => {
    const prelim = prelimById.get(row.id) ?? null;
    const official = officialById.get(row.source_cycle_processing_id) ?? null;
    const officialView = official
      ? {
          pointsObtained: Number(official.points_obtained ?? 0),
          pointsPossible: Number(official.points_possible ?? 0),
          percentage: Number(official.percentage ?? 0),
          maturityLevel:
            official.maturity_level == null ? null : Number(official.maturity_level),
        }
      : null;
    const preliminaryView = prelim
      ? {
          pointsObtained: Number(prelim.points_obtained ?? 0),
          pointsPossible: Number(prelim.points_possible ?? 0),
          percentage: Number(prelim.percentage ?? 0),
          maturityLevel:
            prelim.maturity_level == null ? null : Number(prelim.maturity_level),
        }
      : null;
    return {
      id: row.id,
      cycleId: row.cycle_id,
      referenceYear: Number(row.reference_year),
      quadrimester: Number(row.quadrimester) as Quadrimester,
      calculationVersion: Number(row.calculation_version),
      methodologyVersion: row.methodology_version,
      calculationKind: row.calculation_kind === "automatic" ? "automatic" : "manual",
      calculatedBy: row.calculated_by,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      calculatedAt: row.calculated_at,
      closedAt: row.closed_at,
      sourceProcessingVersion: Number(row.source_processing_version),
      sourcePolicyVersion: row.source_policy_version,
      official: officialView,
      preliminary: preliminaryView,
      deltaPercentagePoints:
        officialView && preliminaryView
          ? Number((preliminaryView.percentage - officialView.percentage).toFixed(2))
          : null,
    };
  });

  const seen = new Set<string>();
  const latestByPeriod = history.filter((item) => {
    const key = `${item.referenceYear}:${item.quadrimester}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { history, latestByPeriod, tracking };
}

async function loadPreliminaryTracking(
  client: TypedSupabaseClient,
  cycleId: string,
): Promise<PreliminaryTrackingContext> {
  const [officialResult, actionResult] = await Promise.all([
    client
      .from("fami_results")
      .select("created_at, cycle_processings!inner(status)")
      .eq("cycle_id", cycleId)
      .eq("scope_type", "global")
      .eq("cycle_processings.status", "completed")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    client
      .from("action_plans")
      .select("created_at, recommendations!inner(cycle_id, cycle_processings!inner(status))")
      .eq("recommendations.cycle_id", cycleId)
      .eq("recommendations.cycle_processings.status", "completed")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  if (officialResult.error) throw officialResult.error;
  if (actionResult.error) throw actionResult.error;

  return {
    officialAvailableAt: officialResult.data?.created_at ?? null,
    earliestActionCreatedAt: actionResult.data?.created_at ?? null,
  };
}
