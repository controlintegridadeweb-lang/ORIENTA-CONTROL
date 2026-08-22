import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadFrozenFamiScopeCatalog } from "@/features/fami/server";
import type { CycleReportScope, ReportEvolutionPoint } from "./report-types";

function referencePeriodLabel(startYear: number, endYear: number): string {
  return startYear === endYear ? String(startYear) : `${startYear}–${endYear}`;
}

type EvolutionCycleRow = {
  id: string;
  period_label: string;
  reference_start_year: number | null;
  reference_end_year: number | null;
};

type EvolutionProcessingRow = {
  id: string;
  cycle_id: string;
  processing_version: number;
  fami_policy_version: string;
  created_at: string;
};

type EvolutionResultRow = {
  cycle_processing_id: string;
  scope_type: string;
  scope_id: string | null;
  percentage: number | null;
  maturity_level: number | null;
  created_at: string | null;
};

/**
 * Evolução institucional por período de referência. Compara diagnósticos
 * distintos do mesmo formulário e organização; `created_at` é apenas metadado
 * do processamento, nunca a fonte do ano apresentado.
 */
export async function loadCycleFamiEvolutionByReferencePeriod(
  supabase: SupabaseClient,
  scope: CycleReportScope,
  selectedProcessing: { id: string; version: number },
): Promise<ReportEvolutionPoint[]> {
  if (scope.referenceStartYear == null || scope.referenceEndYear == null) return [];

  const { data: cyclesData, error: cyclesError } = await supabase
    .from("cycles")
    .select("id, period_label, reference_start_year, reference_end_year, form_versions!inner(form_id)")
    .eq("organization_id", scope.organizationId)
    .eq("form_versions.form_id", scope.formId)
    .not("reference_start_year", "is", null)
    .not("reference_end_year", "is", null)
    .lte("reference_end_year", scope.referenceEndYear);
  if (cyclesError) throw cyclesError;

  const cycles: EvolutionCycleRow[] = (cyclesData ?? []).map((row) => ({
    id: String(row.id),
    period_label: String(row.period_label ?? ""),
    reference_start_year: row.reference_start_year == null ? null : Number(row.reference_start_year),
    reference_end_year: row.reference_end_year == null ? null : Number(row.reference_end_year),
  }));
  if (cycles.length === 0) return [];

  const { data: processingsData, error: processingsError } = await supabase
    .from("cycle_processings")
    .select("id, cycle_id, processing_version, fami_policy_version, created_at")
    .in("cycle_id", cycles.map((row) => row.id))
    .eq("status", "completed")
    .order("processing_version", { ascending: false });
  if (processingsError) throw processingsError;

  const allProcessings: EvolutionProcessingRow[] = (processingsData ?? []).map((row) => ({
    id: String(row.id),
    cycle_id: String(row.cycle_id),
    processing_version: Number(row.processing_version),
    fami_policy_version: String(row.fami_policy_version ?? ""),
    created_at: String(row.created_at ?? ""),
  }));

  const selectedByCycle = new Map<string, EvolutionProcessingRow>();
  for (const processing of allProcessings) {
    if (processing.cycle_id === scope.cycleId) {
      if (processing.id === selectedProcessing.id && processing.processing_version === selectedProcessing.version) {
        selectedByCycle.set(processing.cycle_id, processing);
      }
      continue;
    }
    if (!selectedByCycle.has(processing.cycle_id)) selectedByCycle.set(processing.cycle_id, processing);
  }
  const selectedProcessings = [...selectedByCycle.values()];
  if (selectedProcessings.length === 0) return [];

  const { data: results, error: resultError } = await supabase
    .from("fami_results")
    .select("cycle_processing_id, scope_type, scope_id, percentage, maturity_level, created_at")
    .in("cycle_processing_id", selectedProcessings.map((row) => row.id))
    .in("scope_type", ["global", "axis"]);
  if (resultError) throw resultError;

  const rowsByProcessing = new Map<string, EvolutionResultRow[]>();
  for (const row of (results ?? []) as EvolutionResultRow[]) {
    const key = String(row.cycle_processing_id);
    const values = rowsByProcessing.get(key) ?? [];
    values.push({
      cycle_processing_id: key,
      scope_type: String(row.scope_type),
      scope_id: row.scope_id == null ? null : String(row.scope_id),
      percentage: row.percentage == null ? null : Number(row.percentage),
      maturity_level: row.maturity_level == null ? null : Number(row.maturity_level),
      created_at: row.created_at == null ? null : String(row.created_at),
    });
    rowsByProcessing.set(key, values);
  }

  const cycleById = new Map(cycles.map((row) => [row.id, row]));
  const points: ReportEvolutionPoint[] = [];
  for (const processing of selectedProcessings) {
    const cycle = cycleById.get(processing.cycle_id);
    if (cycle?.reference_start_year == null || cycle.reference_end_year == null) continue;
    const rows = rowsByProcessing.get(processing.id) ?? [];
    const global = rows.find((row) => row.scope_type === "global");
    if (!global) continue;
    const catalog = await loadFrozenFamiScopeCatalog(supabase, processing.cycle_id);
    const axisPercentages: Record<string, number | null> = {};
    for (const row of rows) {
      if (row.scope_type !== "axis" || !row.scope_id) continue;
      axisPercentages[catalog.axes.get(row.scope_id)?.name ?? "Eixo histórico sem identificação"] =
        row.maturity_level == null ? null : Number(row.percentage ?? 0);
    }
    points.push({
      cycleId: processing.cycle_id,
      referenceStartYear: cycle.reference_start_year,
      referenceEndYear: cycle.reference_end_year,
      referenceLabel: referencePeriodLabel(cycle.reference_start_year, cycle.reference_end_year),
      processingVersion: processing.processing_version,
      policyVersion: processing.fami_policy_version,
      createdAt: String(global.created_at ?? processing.created_at),
      globalPercentage: global.maturity_level == null ? null : Number(global.percentage ?? 0),
      globalMaturityLevel: global.maturity_level == null ? null : Number(global.maturity_level),
      axisPercentages,
    });
  }

  return points.sort(
    (a, b) =>
      a.referenceStartYear - b.referenceStartYear ||
      a.referenceEndYear - b.referenceEndYear ||
      a.processingVersion - b.processingVersion,
  );
}
