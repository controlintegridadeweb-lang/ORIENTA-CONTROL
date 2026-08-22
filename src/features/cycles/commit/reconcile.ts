import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { calculateFami, type FamiSummary } from "@/shared/domain/fami";
import {
  CURRENT_FAMI_POLICY,
  FAMI_LEGACY_APPROVED_EVIDENCE_WEIGHT,
  FAMI_WEIGHTS,
  SUPPORTED_FAMI_POLICY_VERSIONS,
  famiPolicyFromFrozenWeights,
  type FamiPolicy,
  type FamiThreshold,
} from "@/shared/domain/fami-policy";
import { collectProcessingSnapshot } from "./collect";

/** Resultado de conferência: nunca grava FAMI nem altera processamento. */
export class FamiProcessingNotFoundError extends Error {
  constructor() {
    super("Nenhum processamento concluído foi encontrado para o diagnóstico.");
    this.name = "FamiProcessingNotFoundError";
  }
}

export type FamiReconciliationResult = {
  cycleId: string;
  cycleProcessingId: string;
  processingVersion: number;
  policy: FamiPolicy;
  /** Mantido para consumidores que exibem apenas o consolidado global. */
  recalculated: FamiSummary["global"];
  stored: StoredFamiScope | null;
  scopes: FamiScopeComparison[];
  matches: boolean;
};

type ScopeType = "section" | "axis" | "global";
type ComparableMaturityLevel = number | null;

type ComparableFamiScope = {
  pointsObtained: number;
  pointsPossible: number;
  percentage: number;
  maturityLevel: ComparableMaturityLevel;
};

type StoredFamiScope = ComparableFamiScope & {
  scopeType: ScopeType;
  scopeId: string | null;
};

type FamiScopeComparison = {
  scopeType: ScopeType;
  scopeId: string | null;
  recalculated: ComparableFamiScope | null;
  stored: ComparableFamiScope | null;
  matches: boolean;
};

const processingPolicyRowSchema = z.object({
  id: z.string().min(1),
  processing_version: z.number().int().positive(),
  status: z.enum(["working", "completed"]),
  fami_policy_version: z.string(),
  fami_scoring_model: z.enum(["evidence_weighted"]).nullable(),
  yes_without_evidence_weight: z.number().nullable(),
  yes_with_approved_evidence_weight: z.number().nullable(),
  thresholds: z.unknown(),
});

const storedFamiRowSchema = z.object({
  scope_type: z.enum(["section", "axis", "global"]),
  scope_id: z.string().nullable(),
  points_obtained: z.coerce.number(),
  points_possible: z.coerce.number(),
  percentage: z.coerce.number(),
  maturity_level: z.coerce.number().int().min(1).max(5).nullable(),
});

type ProcessingPolicyRow = z.infer<typeof processingPolicyRowSchema>;

function parseThresholds(value: unknown): FamiThreshold[] {
  if (!Array.isArray(value)) {
    throw new Error("fami_policy_invalid: thresholds congelados inválidos.");
  }

  const thresholds = value.map((item) => {
    const row = item as { level?: unknown; maxPercentage?: unknown };
    const level = Number(row.level);
    const maxPercentage = Number(row.maxPercentage);
    if (
      !Number.isInteger(level) ||
      level < 1 ||
      level > 5 ||
      !Number.isFinite(maxPercentage)
    ) {
      throw new Error("fami_policy_invalid: thresholds congelados inválidos.");
    }
    return { level: level as FamiThreshold["level"], maxPercentage };
  });

  if (thresholds.length !== CURRENT_FAMI_POLICY.thresholds.length) {
    throw new Error("fami_policy_invalid: thresholds congelados incompletos.");
  }

  const ordered = thresholds.sort((a, b) => a.level - b.level);
  const matchesOfficialPolicy = ordered.every((threshold, index) => {
    const official = CURRENT_FAMI_POLICY.thresholds[index];
    return official != null &&
      threshold.level === official.level &&
      threshold.maxPercentage === official.maxPercentage;
  });
  if (!matchesOfficialPolicy) {
    throw new Error("fami_policy_invalid: thresholds congelados divergem da política FAMI oficial.");
  }

  return ordered;
}

const ALLOWED_APPROVED_WEIGHTS = new Set<number>([
  FAMI_WEIGHTS.WITH_REQUIRED_EVIDENCE_APPROVED,
  FAMI_LEGACY_APPROVED_EVIDENCE_WEIGHT,
]);

export function famiPolicyFromProcessing(row: ProcessingPolicyRow): FamiPolicy {
  const thresholds = parseThresholds(row.thresholds);
  const yesWithoutEvidenceWeight = Number(row.yes_without_evidence_weight);
  const yesWithApprovedEvidenceWeight = Number(row.yes_with_approved_evidence_weight);
  const supportedVersion = (SUPPORTED_FAMI_POLICY_VERSIONS as readonly string[]).includes(
    row.fami_policy_version,
  );

  if (
    row.fami_scoring_model !== CURRENT_FAMI_POLICY.scoringModel ||
    !supportedVersion ||
    yesWithoutEvidenceWeight !== FAMI_WEIGHTS.WITHOUT_REQUIRED_EVIDENCE ||
    !ALLOWED_APPROVED_WEIGHTS.has(yesWithApprovedEvidenceWeight)
  ) {
    throw new Error(
      "fami_policy_invalid: processamento sem política FAMI ponderada por evidência congelada.",
    );
  }

  // Conferência usa a política congelada do processamento.
  // Históricos v3–v6 continuam coerentes com fami_results;
  // novos processamentos v7 usam peso 2,0 sem baseline. Não sobrescreve snapshot.
  return famiPolicyFromFrozenWeights({
    version: row.fami_policy_version,
    yesWithoutEvidenceWeight,
    yesWithApprovedEvidenceWeight,
    thresholds,
  });
}

function scopeKey(scopeType: ScopeType, scopeId: string | null): string {
  return `${scopeType}:${scopeId ?? "global"}`;
}

function normalizedMaturityLevel(
  level: FamiSummary["global"]["maturityLevel"],
): ComparableMaturityLevel {
  return level === "N/A" ? null : level;
}

function expectedScopes(summary: FamiSummary): StoredFamiScope[] {
  const sections = Object.entries(summary.bySection).map(([scopeId, value]) => ({
    scopeType: "section" as const,
    scopeId,
    pointsObtained: value.pointsObtained,
    pointsPossible: value.pointsPossible,
    percentage: value.percentage,
    maturityLevel: normalizedMaturityLevel(value.maturityLevel),
  }));
  const axes = Object.entries(summary.byAxis).map(([scopeId, value]) => ({
    scopeType: "axis" as const,
    scopeId,
    pointsObtained: value.pointsObtained,
    pointsPossible: value.pointsPossible,
    percentage: value.percentage,
    maturityLevel: normalizedMaturityLevel(value.maturityLevel),
  }));
  return [
    ...sections,
    ...axes,
    {
      scopeType: "global",
      scopeId: null,
      pointsObtained: summary.global.pointsObtained,
      pointsPossible: summary.global.pointsPossible,
      percentage: summary.global.percentage,
      maturityLevel: normalizedMaturityLevel(summary.global.maturityLevel),
    },
  ];
}

function mapStoredRows(rows: unknown[]): StoredFamiScope[] {
  return z.array(storedFamiRowSchema).parse(rows).map((row) => ({
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    pointsObtained: row.points_obtained,
    pointsPossible: row.points_possible,
    percentage: row.percentage,
    maturityLevel: row.maturity_level,
  }));
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.01;
}

function scopesEqual(
  recalculated: ComparableFamiScope | null,
  stored: ComparableFamiScope | null,
): boolean {
  return Boolean(recalculated && stored) &&
    approximatelyEqual(recalculated!.pointsObtained, stored!.pointsObtained) &&
    approximatelyEqual(recalculated!.pointsPossible, stored!.pointsPossible) &&
    approximatelyEqual(recalculated!.percentage, stored!.percentage) &&
    recalculated!.maturityLevel === stored!.maturityLevel;
}

function compareScopes(
  recalculatedRows: StoredFamiScope[],
  storedRows: StoredFamiScope[],
): FamiScopeComparison[] {
  const recalculatedByKey = new Map(
    recalculatedRows.map((row) => [scopeKey(row.scopeType, row.scopeId), row]),
  );
  const storedByKey = new Map(
    storedRows.map((row) => [scopeKey(row.scopeType, row.scopeId), row]),
  );
  const keys = [...new Set([...recalculatedByKey.keys(), ...storedByKey.keys()])].sort();

  return keys.map((key) => {
    const recalculatedRow = recalculatedByKey.get(key) ?? null;
    const storedRow = storedByKey.get(key) ?? null;
    const reference = recalculatedRow ?? storedRow;
    if (!reference) throw new Error("fami_reconciliation_invalid_scope");

    const recalculated = recalculatedRow
      ? {
          pointsObtained: recalculatedRow.pointsObtained,
          pointsPossible: recalculatedRow.pointsPossible,
          percentage: recalculatedRow.percentage,
          maturityLevel: recalculatedRow.maturityLevel,
        }
      : null;
    const stored = storedRow
      ? {
          pointsObtained: storedRow.pointsObtained,
          pointsPossible: storedRow.pointsPossible,
          percentage: storedRow.percentage,
          maturityLevel: storedRow.maturityLevel,
        }
      : null;

    return {
      scopeType: reference.scopeType,
      scopeId: reference.scopeId,
      recalculated,
      stored,
      matches: scopesEqual(recalculated, stored),
    };
  });
}

/**
 * Recalcula um FAMI histórico sem materializar uma nova versão.
 *
 * A origem dos critérios é o snapshot imutável do processamento concluído.
 * A política vem do próprio `cycle_processing`, não da configuração corrente;
 * assim, waiver, evidência e resposta alterados depois do fechamento nunca
 * mudam a conferência histórica.
 */
export async function reconcileCycleFami(
  supabase: SupabaseClient,
  params: { cycleId: string; cycleProcessingId?: string },
): Promise<FamiReconciliationResult> {
  let query = supabase
    .from("cycle_processings")
    .select(
      "id, processing_version, status, fami_policy_version, fami_scoring_model, yes_without_evidence_weight, yes_with_approved_evidence_weight, thresholds",
    )
    .eq("cycle_id", params.cycleId)
    .eq("status", "completed")
    .order("processing_version", { ascending: false })
    .limit(1);

  if (params.cycleProcessingId) {
    query = supabase
      .from("cycle_processings")
      .select(
        "id, processing_version, status, fami_policy_version, fami_scoring_model, yes_without_evidence_weight, yes_with_approved_evidence_weight, thresholds",
      )
      .eq("cycle_id", params.cycleId)
      .eq("id", params.cycleProcessingId)
      .eq("status", "completed")
      .limit(1);
  }

  const { data: processing, error: processingError } = await query.maybeSingle();
  if (processingError) throw processingError;
  if (!processing) {
    throw new FamiProcessingNotFoundError();
  }

  const row = processingPolicyRowSchema.parse(processing);
  const policy = famiPolicyFromProcessing(row);
  const { questions } = await collectProcessingSnapshot(supabase, {
    cycleId: params.cycleId,
    cycleProcessingId: row.id,
  });
  const summary = calculateFami(questions, policy);

  const { data: storedData, error: storedError } = await supabase
    .from("fami_results")
    .select(
      "scope_type, scope_id, points_obtained, points_possible, percentage, maturity_level",
    )
    .eq("cycle_processing_id", row.id);
  if (storedError) throw storedError;

  const storedRows = mapStoredRows(storedData ?? []);
  const scopes = compareScopes(expectedScopes(summary), storedRows);
  const globalStored = storedRows.find(
    (storedRow) => storedRow.scopeType === "global" && storedRow.scopeId == null,
  ) ?? null;

  return {
    cycleId: params.cycleId,
    cycleProcessingId: row.id,
    processingVersion: row.processing_version,
    policy,
    recalculated: summary.global,
    stored: globalStored,
    scopes,
    matches: scopes.length > 0 && scopes.every((scope) => scope.matches),
  };
}
