import "server-only";

import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { resolveCycleOperationalScope } from "@/infrastructure/supabase/cycle-operational-scope";
import {
  resolveCycleProcessingIdForCycle,
  resolveCycleProcessingMetadataForCycle,
  resolveProcessingMetadataMapForCycle,
} from "./resolve-cycle-processing";
import { brtYearUtcBounds, getCalendarYearBrt } from "./fami-year";
import {
  buildFamiScopeIntegrityWarnings,
  loadFrozenFamiScopeCatalog,
  mapFrozenAxisMaturityRows,
} from "./frozen-scope-catalog";
import type { AxisMaturity } from "./types";
import type {
  FamiEvolutionPoint,
  FamiEvolutionYearPoint,
  FamiSectionSnapshot,
  FamiSnapshot,
} from "./read-types";
import { sortSectionsByFormOrder } from "./section-detail-view-model";

type Client = ReturnType<typeof createSupabaseServiceRoleClient>;

function getClient(): Client {
  return createSupabaseServiceRoleClient();
}

export type FamiGlobalReadout = {
  percentage: number;
  maturityLevel: number | null;
  pointsObtained: number;
  pointsPossible: number;
  createdAt: string;
};

type GlobalRow = {
  cycle_processing_id: string;
  created_at: string;
  percentage: number | null;
  maturity_level: number | null;
  points_obtained: number | null;
  points_possible: number | null;
};

async function globalRowsForCycle(client: Client, cycleId: string): Promise<{
  versionByProcessing: Map<string, number>;
  policyByProcessing: Map<string, string>;
  rows: GlobalRow[];
}> {
  const allMetadataByProcessing = await resolveProcessingMetadataMapForCycle(client, cycleId);
  const metadataByProcessing = new Map(
    [...allMetadataByProcessing.entries()].filter(([, metadata]) => metadata.status === "completed"),
  );
  const versionByProcessing = new Map(
    [...metadataByProcessing.entries()].map(([id, metadata]) => [id, metadata.processingVersion]),
  );
  const policyByProcessing = new Map(
    [...metadataByProcessing.entries()].map(([id, metadata]) => [id, metadata.policyVersion]),
  );
  if (versionByProcessing.size === 0) return { versionByProcessing, policyByProcessing, rows: [] };

  const { data, error } = await client
    .from("fami_results")
    .select("cycle_processing_id,created_at,percentage,maturity_level,points_obtained,points_possible")
    .in("cycle_processing_id", Array.from(versionByProcessing.keys()))
    .eq("scope_type", "global");
  if (error) throw error;

  return {
    versionByProcessing,
    policyByProcessing,
    rows: (data ?? []) as GlobalRow[],
  };
}

function latestGlobalRow(rows: GlobalRow[], versionByProcessing: Map<string, number>): GlobalRow | null {
  return [...rows]
    .sort((a, b) => {
      const byVersion = (versionByProcessing.get(b.cycle_processing_id) ?? 0) -
        (versionByProcessing.get(a.cycle_processing_id) ?? 0);
      if (byVersion !== 0) return byVersion;
      return String(b.created_at).localeCompare(String(a.created_at));
    })[0] ?? null;
}

/** Último processamento FAMI oficial de um ciclo específico. */
export async function getLatestFamiVersionForCycle(
  cycleId: string,
): Promise<{ processingVersion: number; policyVersion: string; createdAt: string; cycleId: string } | null> {
  const { versionByProcessing, policyByProcessing, rows } = await globalRowsForCycle(getClient(), cycleId);
  const latest = latestGlobalRow(rows, versionByProcessing);
  if (!latest) return null;
  const processingVersion = versionByProcessing.get(latest.cycle_processing_id);
  if (processingVersion == null) return null;
  return {
    cycleId,
    processingVersion,
    policyVersion: policyByProcessing.get(latest.cycle_processing_id) ?? "",
    createdAt: String(latest.created_at ?? ""),
  };
}

/** Linha global FAMI de um processamento pertencente ao ciclo informado. */
export async function loadFamiGlobalForCycleVersion(
  cycleId: string,
  processingVersion: number,
): Promise<FamiGlobalReadout | null> {
  const client = getClient();
  const processingId = await resolveCycleProcessingIdForCycle(client, cycleId, processingVersion);
  if (!processingId) return null;

  const { data, error } = await client
    .from("fami_results")
    .select("percentage,maturity_level,points_obtained,points_possible,created_at")
    .eq("cycle_processing_id", processingId)
    .eq("scope_type", "global")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    percentage: Number(data.percentage ?? 0),
    maturityLevel: data.maturity_level == null ? null : Number(data.maturity_level),
    pointsObtained: Number(data.points_obtained ?? 0),
    pointsPossible: Number(data.points_possible ?? 0),
    createdAt: String(data.created_at ?? ""),
  };
}

/** Eixos de um processamento pertencente ao ciclo informado. */
export async function loadAxisMaturityForCycleVersion(
  cycleId: string,
  processingVersion: number,
): Promise<AxisMaturity[]> {
  const client = getClient();
  const processingId = await resolveCycleProcessingIdForCycle(client, cycleId, processingVersion);
  if (!processingId) return [];

  const { data, error } = await client
    .from("fami_results")
    .select("scope_id,percentage,maturity_level")
    .eq("cycle_processing_id", processingId)
    .eq("scope_type", "axis");
  if (error) throw error;

  const catalog = await loadFrozenFamiScopeCatalog(client, cycleId);
  return mapFrozenAxisMaturityRows(
    (data ?? []).map((row) => ({
      scopeId: row.scope_id as string | null,
      percentage: row.percentage == null ? null : Number(row.percentage),
      maturityLevel: row.maturity_level == null ? null : Number(row.maturity_level),
    })),
    catalog,
  );
}

/** Snapshot completo de um ciclo e processamento específicos. */
async function buildFamiSnapshotForCycle(
  cycleId: string,
  processingVersion: number,
): Promise<FamiSnapshot | null> {
  const client = getClient();
  const scope = await resolveCycleOperationalScope(client, cycleId);
  if (!scope) return null;

  const processing = await resolveCycleProcessingMetadataForCycle(client, cycleId, processingVersion);
  if (!processing || processing.status !== "completed") return null;
  const processingId = processing.id;

  const [global, axes, sectionsResult] = await Promise.all([
    loadFamiGlobalForCycleVersion(cycleId, processingVersion),
    loadAxisMaturityForCycleVersion(cycleId, processingVersion),
    client
      .from("fami_results")
      .select("scope_id,percentage,maturity_level,points_obtained,points_possible")
      .eq("cycle_processing_id", processingId)
      .eq("scope_type", "section"),
  ]);
  if (sectionsResult.error) throw sectionsResult.error;

  const sectionRows = sectionsResult.data ?? [];
  const catalog = await loadFrozenFamiScopeCatalog(client, cycleId);
  const sections: FamiSectionSnapshot[] = sortSectionsByFormOrder(
    sectionRows.flatMap((row) => {
      const sectionId = row.scope_id as string | null;
      if (!sectionId) return [];
      const frozen = catalog.sections.get(sectionId);
      const axisId = frozen?.axisId ?? "";
      return [{
        sectionId,
        sectionName: frozen?.name ?? "Seção histórica sem identificação",
        sectionOrder: frozen?.order ?? Number.MAX_SAFE_INTEGER,
        axisId,
        axisName: catalog.axes.get(axisId)?.name ?? "Eixo histórico sem identificação",
        percentage: Number(row.percentage ?? 0),
        maturityLevel: row.maturity_level == null ? null : Number(row.maturity_level),
        pointsObtained: Number(row.points_obtained ?? 0),
        pointsPossible: Number(row.points_possible ?? 0),
      }];
    }),
  );
  const integrityWarnings = buildFamiScopeIntegrityWarnings(
    catalog,
    axes.flatMap((axis) => axis.axisId ? [axis.axisId] : []),
    sections.map((section) => section.sectionId),
  );

  return {
    formId: scope.formId,
    organizationId: scope.cycle.organizationId,
    processingVersion,
    policyVersion: processing.policyVersion,
    global: global
      ? {
          percentage: global.percentage,
          maturityLevel: global.maturityLevel,
          pointsObtained: global.pointsObtained,
          pointsPossible: global.pointsPossible,
          createdAt: global.createdAt,
        }
      : null,
    axes,
    sections,
    integrityWarnings,
  };
}

export async function getFamiSnapshotLatestForCycle(cycleId: string): Promise<FamiSnapshot | null> {
  const latest = await getLatestFamiVersionForCycle(cycleId);
  if (!latest) return null;
  return buildFamiSnapshotForCycle(cycleId, latest.processingVersion);
}

export async function getAvailableFamiYearsForCycle(cycleId: string): Promise<number[]> {
  const { rows } = await globalRowsForCycle(getClient(), cycleId);
  return Array.from(
    new Set(rows.map((row) => String(row.created_at ?? "")).filter(Boolean).map(getCalendarYearBrt)),
  ).sort((a, b) => b - a);
}

export async function resolveYearEndFamiVersionForCycle(
  cycleId: string,
  year: number,
): Promise<number | null> {
  const { fromInclusive, toInclusive } = brtYearUtcBounds(year);
  const { versionByProcessing, rows } = await globalRowsForCycle(getClient(), cycleId);
  const inYear = rows.filter((row) =>
    String(row.created_at) >= fromInclusive && String(row.created_at) <= toInclusive,
  );
  const latest = latestGlobalRow(inYear, versionByProcessing);
  return latest ? (versionByProcessing.get(latest.cycle_processing_id) ?? null) : null;
}

export async function buildFamiSnapshotForCycleYear(
  cycleId: string,
  year: number,
): Promise<FamiSnapshot | null> {
  const version = await resolveYearEndFamiVersionForCycle(cycleId, year);
  return version == null ? null : buildFamiSnapshotForCycle(cycleId, version);
}

export async function getFamiEvolutionForCycle(cycleId: string): Promise<FamiEvolutionPoint[]> {
  const client = getClient();
  const allMetadataByProcessing = await resolveProcessingMetadataMapForCycle(client, cycleId);
  const metadataByProcessing = new Map(
    [...allMetadataByProcessing.entries()].filter(([, metadata]) => metadata.status === "completed"),
  );
  const versionByProcessing = new Map(
    [...metadataByProcessing.entries()].map(([id, metadata]) => [id, metadata.processingVersion]),
  );
  if (!versionByProcessing.size) return [];
  const { data, error } = await client
    .from("fami_results")
    .select("cycle_processing_id,created_at,scope_type,scope_id,percentage,maturity_level")
    .in("cycle_processing_id", Array.from(versionByProcessing.keys()))
    .in("scope_type", ["global", "axis"])
    .order("created_at", { ascending: true });
  if (error) throw error;

  const catalog = await loadFrozenFamiScopeCatalog(client, cycleId);

  const byVersion = new Map<number, {
    policyVersion: string;
    createdAt: string;
    globalPercentage: number | null;
    globalMaturityLevel: number | null;
    axisPercentages: Record<string, number | null>;
  }>();

  for (const row of data ?? []) {
    const version = versionByProcessing.get(row.cycle_processing_id as string);
    if (version == null) continue;
    const current = byVersion.get(version) ?? {
      policyVersion: metadataByProcessing.get(row.cycle_processing_id as string)?.policyVersion ?? "",
      createdAt: String(row.created_at ?? ""),
      globalPercentage: null,
      globalMaturityLevel: null,
      axisPercentages: {},
    };
    if (String(row.created_at ?? "") > current.createdAt) current.createdAt = String(row.created_at ?? "");
    if (row.scope_type === "global") {
      current.globalMaturityLevel = row.maturity_level == null ? null : Number(row.maturity_level);
      current.globalPercentage = current.globalMaturityLevel == null
        ? null
        : Number(row.percentage ?? 0);
    } else {
      const axisId = row.scope_id as string | null;
      if (axisId) {
        const axisName = catalog.axes.get(axisId)?.name ?? "Eixo histórico sem identificação";
        current.axisPercentages[axisName] = row.maturity_level == null
          ? null
          : Number(row.percentage ?? 0);
      }
    }
    byVersion.set(version, current);
  }

  return [...byVersion.entries()]
    .sort(([a], [b]) => a - b)
    .map(([processingVersion, value]) => ({ processingVersion, ...value }));
}

export async function getFamiEvolutionByYearForCycle(
  cycleId: string,
): Promise<FamiEvolutionYearPoint[]> {
  const evolution = await getFamiEvolutionForCycle(cycleId);
  const bestByYear = new Map<number, FamiEvolutionPoint>();
  for (const point of evolution) {
    if (!point.createdAt) continue;
    const year = getCalendarYearBrt(point.createdAt);
    const current = bestByYear.get(year);
    if (!current || point.createdAt > current.createdAt ||
      (point.createdAt === current.createdAt && point.processingVersion > current.processingVersion)) {
      bestByYear.set(year, point);
    }
  }
  return [...bestByYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, point]) => ({
      year,
      processingVersion: point.processingVersion,
      policyVersion: point.policyVersion,
      createdAt: point.createdAt,
      globalPercentage: point.globalPercentage,
      globalMaturityLevel: point.globalMaturityLevel,
      axisPercentages: point.axisPercentages,
    }));
}
