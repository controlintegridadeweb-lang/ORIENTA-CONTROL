import { z } from "zod";
import { apiResponseSchema, buildHeaders, formatError, parseJson } from "@/infrastructure/api/fetch-client";
import type { FamiEvolutionPoint, FamiEvolutionYearPoint, FamiSnapshot } from "@/features/fami/queries";

const axisMaturitySchema = z.object({
  axisId: z.string().optional(),
  axisName: z.string(),
  percentage: z.number().finite(),
  maturityLevel: z.number().finite().nullable(),
});
const sectionSnapshotSchema = z.object({
  sectionId: z.string(),
  sectionName: z.string(),
  sectionOrder: z.number().int(),
  axisId: z.string(),
  axisName: z.string(),
  percentage: z.number().finite(),
  maturityLevel: z.number().finite().nullable(),
  pointsObtained: z.number().finite(),
  pointsPossible: z.number().finite(),
});
const globalSnapshotSchema = z.object({
  percentage: z.number().finite(),
  maturityLevel: z.number().finite().nullable(),
  pointsObtained: z.number().finite(),
  pointsPossible: z.number().finite(),
  createdAt: z.string(),
});
const famiSnapshotSchema = z.object({
  formId: z.string(),
  organizationId: z.string(),
  processingVersion: z.number().int().nullable(),
  policyVersion: z.string().nullable(),
  global: globalSnapshotSchema.nullable(),
  axes: z.array(axisMaturitySchema),
  sections: z.array(sectionSnapshotSchema),
  integrityWarnings: z.array(z.string()).optional(),
});
const axisPercentagesSchema = z.record(z.string(), z.number().finite().nullable());
const evolutionPointSchema = z.object({
  processingVersion: z.number().int(),
  policyVersion: z.string(),
  createdAt: z.string(),
  globalPercentage: z.number().finite().nullable(),
  globalMaturityLevel: z.number().finite().nullable(),
  axisPercentages: axisPercentagesSchema,
});
const evolutionYearPointSchema = evolutionPointSchema.extend({ year: z.number().int() });
const versionMetaSchema = z.object({
  createdAt: z.string(),
  processingVersion: z.number().int().optional(),
  policyVersion: z.string().optional(),
  cycleId: z.string().optional(),
});
const snapshotResponseSchema = apiResponseSchema({
  snapshot: famiSnapshotSchema.nullable(),
  evolution: z.array(evolutionPointSchema),
  evolutionByYear: z.array(evolutionYearPointSchema),
  availableYears: z.array(z.number().int()),
  latestVersionMeta: versionMetaSchema.nullable(),
  evolutionModeUsed: z.enum(["versions", "years"]),
  yearRequested: z.number().int().nullable(),
  scopeKind: z.literal("cycle").optional(),
});
const famiCycleSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  formId: z.string(),
  formName: z.string(),
  formVersion: z.number().int(),
  periodLabel: z.string(),
  closedAt: z.string().nullable(),
});
const famiCyclesResponseSchema = apiResponseSchema({ cycles: z.array(famiCycleSchema).optional() });
const reconciliationSchema = apiResponseSchema({
  processingVersion: z.number().int(),
  policyVersion: z.string(),
  matches: z.boolean(),
});

type FamiSnapshotScopeKind = "cycle";
export type FamiCycleOption = z.infer<typeof famiCycleSchema>;
type FamiSnapshotMeta = z.infer<typeof versionMetaSchema>;
export type FamiSnapshotResponse = {
  snapshot: FamiSnapshot | null;
  evolution: FamiEvolutionPoint[];
  evolutionByYear: FamiEvolutionYearPoint[];
  availableYears: number[];
  latestVersionMeta: FamiSnapshotMeta | null;
  evolutionModeUsed: "versions" | "years";
  yearRequested: number | null;
  scopeKind?: FamiSnapshotScopeKind;
};

type ExactCycleParams = {
  cycleId: string;
  authRole: "admin" | "respondent";
  year?: number | null;
  evolutionMode?: "versions" | "years";
};

export async function loadFamiSnapshot(params: ExactCycleParams): Promise<FamiSnapshotResponse> {
  const qs = new URLSearchParams({ cycleId: params.cycleId });
  if (params.year != null && Number.isFinite(params.year)) qs.set("year", String(params.year));
  if (params.evolutionMode != null) qs.set("evolutionMode", params.evolutionMode);
  const res = await fetch(`/api/fami/snapshot?${qs.toString()}`, {
    headers: buildHeaders(), credentials: "include",
  });
  const body = await parseJson(res, snapshotResponseSchema);
  if (!res.ok) throw new Error(formatError(body, "Falha ao carregar FAMI."));
  return body;
}

export async function loadFamiCycles(params: {
  organizationId?: string;
  authRole: "admin" | "respondent";
}): Promise<FamiCycleOption[]> {
  const qs = new URLSearchParams();
  if (params.organizationId) qs.set("organizationId", params.organizationId);
  const res = await fetch(`/api/fami/cycles${qs.size ? `?${qs}` : ""}`, {
    headers: buildHeaders(), credentials: "include",
  });
  const body = await parseJson(res, famiCyclesResponseSchema);
  if (!res.ok || !body.cycles) throw new Error(formatError(body, "Falha ao carregar diagnósticos FAMI."));
  return body.cycles;
}

export async function reconcileFamiRequest(params: {
  cycleId: string;
  authRole: "admin";
}): Promise<{ processingVersion: number; policyVersion: string; matches: boolean }> {
  const res = await fetch("/api/fami/reconcile", {
    method: "POST", headers: buildHeaders(), body: JSON.stringify({ cycleId: params.cycleId, dryRun: true }),
  });
  const body = await parseJson(res, reconciliationSchema);
  if (!res.ok) throw new Error(formatError(body, "Falha ao conferir FAMI."));
  return body;
}
