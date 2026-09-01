import "server-only";

import { z } from "zod";
import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";
import {
  buildQuadrimesterEvolution,
  type QuadrimesterEvolution,
} from "./evolution";
import { listPreliminaryCriterionRows, type PreliminaryCriterionRow } from "./criterion-read";
import type { PreliminaryCheckpoint } from "./read";
import type { Quadrimester } from "./domain";
import { quadrimesterPeriod } from "./domain";
import {
  loadPreliminaryFamiScopedScores,
  type PreliminaryFamiAxisScore,
  type PreliminaryFamiSectionScore,
} from "./export-fami-scores";

export type PreliminaryExportDetail = {
  checkpoint: PreliminaryCheckpoint;
  organizationName: string;
  formName: string;
  periodLabel: string;
  evolution: QuadrimesterEvolution | null;
  criteria: PreliminaryCriterionRow[];
  famiByAxis: PreliminaryFamiAxisScore[];
  famiSections: PreliminaryFamiSectionScore[];
};

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const exportScopeNameSchema = z.object({ name: z.string() });
const exportScopeSchema = z.object({
  period_label: z.string(),
  organizations: z.union([exportScopeNameSchema, z.array(exportScopeNameSchema)]).nullable(),
  form_versions: z
    .union([
      z.object({
        forms: z.union([exportScopeNameSchema, z.array(exportScopeNameSchema)]).nullable(),
      }),
      z.array(
        z.object({
          forms: z.union([exportScopeNameSchema, z.array(exportScopeNameSchema)]).nullable(),
        }),
      ),
    ])
    .nullable(),
});

async function loadExportScope(
  client: TypedSupabaseClient,
  cycleId: string,
): Promise<{ organizationName: string; formName: string; periodLabel: string } | null> {
  const { data, error } = await client
    .from("cycles")
    .select(
      "period_label, organizations!inner(name), form_versions!inner(forms!form_versions_form_id_fkey!inner(name))",
    )
    .eq("id", cycleId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = exportScopeSchema.parse(data);
  const organization = firstRelated(row.organizations);
  const formVersion = firstRelated(row.form_versions);
  const form = firstRelated(formVersion?.forms);
  if (!organization?.name || !form?.name) return null;
  return {
    organizationName: organization.name,
    formName: form.name,
    periodLabel: row.period_label,
  };
}

async function loadCheckpointById(
  client: TypedSupabaseClient,
  processingId: string,
): Promise<PreliminaryCheckpoint | null> {
  const { data: row, error } = await client
    .from("fami_preliminary_processings")
    .select(
      "id, cycle_id, reference_year, quadrimester, calculation_version, methodology_version, calculation_kind, calculated_by, period_start, period_end, calculated_at, closed_at, source_cycle_processing_id, source_processing_version, source_policy_version",
    )
    .eq("id", processingId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const [preliminaryResult, officialResult] = await Promise.all([
    client
      .from("fami_preliminary_results")
      .select(
        "preliminary_processing_id,points_obtained,points_possible,percentage,maturity_level",
      )
      .eq("preliminary_processing_id", processingId)
      .eq("scope_type", "global")
      .maybeSingle(),
    client
      .from("fami_results")
      .select(
        "cycle_processing_id,points_obtained,points_possible,percentage,maturity_level",
      )
      .eq("cycle_processing_id", row.source_cycle_processing_id)
      .eq("scope_type", "global")
      .maybeSingle(),
  ]);
  if (preliminaryResult.error) throw preliminaryResult.error;
  if (officialResult.error) throw officialResult.error;

  const official = officialResult.data
    ? {
        pointsObtained: Number(officialResult.data.points_obtained ?? 0),
        pointsPossible: Number(officialResult.data.points_possible ?? 0),
        percentage: Number(officialResult.data.percentage ?? 0),
        maturityLevel:
          officialResult.data.maturity_level == null
            ? null
            : Number(officialResult.data.maturity_level),
      }
    : null;
  const prelim = preliminaryResult.data
    ? {
        pointsObtained: Number(preliminaryResult.data.points_obtained ?? 0),
        pointsPossible: Number(preliminaryResult.data.points_possible ?? 0),
        percentage: Number(preliminaryResult.data.percentage ?? 0),
        maturityLevel:
          preliminaryResult.data.maturity_level == null
            ? null
            : Number(preliminaryResult.data.maturity_level),
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
    official,
    preliminary: prelim,
    deltaPercentagePoints:
      official && prelim
        ? Number((prelim.percentage - official.percentage).toFixed(2))
        : null,
  };
}

async function loadPreviousCheckpoint(
  client: TypedSupabaseClient,
  checkpoint: PreliminaryCheckpoint,
): Promise<PreliminaryCheckpoint | null> {
  if (checkpoint.quadrimester <= 1) return null;
  const { data, error } = await client
    .from("fami_preliminary_processings")
    .select("id")
    .eq("cycle_id", checkpoint.cycleId)
    .eq("reference_year", checkpoint.referenceYear)
    .eq("quadrimester", checkpoint.quadrimester - 1)
    .order("calculation_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) return null;
  return loadCheckpointById(client, data.id);
}

export async function loadPreliminaryExportDetail(
  client: TypedSupabaseClient,
  processingId: string,
): Promise<PreliminaryExportDetail | null> {
  const checkpoint = await loadCheckpointById(client, processingId);
  if (!checkpoint?.preliminary) return null;

  const scope = await loadExportScope(client, checkpoint.cycleId);
  if (!scope) return null;

  const [criteria, previousCheckpoint, famiScoped] = await Promise.all([
    listPreliminaryCriterionRows(client, [processingId]),
    loadPreviousCheckpoint(client, checkpoint),
    loadPreliminaryFamiScopedScores(client, processingId, checkpoint.cycleId),
  ]);

  const previousCriteria = previousCheckpoint
    ? await listPreliminaryCriterionRows(client, [previousCheckpoint.id])
    : [];

  const evolution = buildQuadrimesterEvolution({
    officialPercentage: checkpoint.official?.percentage ?? null,
    previousPreliminaryPercentage: previousCheckpoint?.preliminary?.percentage ?? null,
    currentPreliminaryPercentage: checkpoint.preliminary.percentage,
    previous: previousCriteria.map((row) => ({
      questionVersionId: row.questionVersionId,
      questionPrompt: row.questionPrompt,
      criterionCompleted: row.criterionCompleted,
      activeActionCount: row.activeActionCount,
      recoveredPoints: row.recoveredPoints,
      preliminaryPoints: row.preliminaryPoints,
      officialPoints: row.officialPoints,
    })),
    current: criteria.map((row) => ({
      questionVersionId: row.questionVersionId,
      questionPrompt: row.questionPrompt,
      criterionCompleted: row.criterionCompleted,
      activeActionCount: row.activeActionCount,
      recoveredPoints: row.recoveredPoints,
      preliminaryPoints: row.preliminaryPoints,
      officialPoints: row.officialPoints,
    })),
  });

  return {
    checkpoint,
    organizationName: scope.organizationName,
    formName: scope.formName,
    periodLabel: scope.periodLabel,
    evolution,
    criteria,
    famiByAxis: famiScoped.byAxis,
    famiSections: famiScoped.sections,
  };
}

export function preliminaryExportPeriodLabel(
  referenceYear: number,
  quadrimester: Quadrimester,
): string {
  return quadrimesterPeriod(referenceYear, quadrimester).label;
}
