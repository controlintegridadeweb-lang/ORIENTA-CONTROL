import { z } from "zod";
import { apiResponseSchema, buildHeaders, formatError, parseJson } from "@/infrastructure/api/fetch-client";
import type { AxisMaturity } from "@/features/fami";

const axisMaturitySchema = z.object({
  axisId: z.string().optional(),
  axisName: z.string(),
  percentage: z.number().finite(),
  maturityLevel: z.number().finite().nullable(),
});

const dashboardMaturitySchema = apiResponseSchema({
  items: z.array(axisMaturitySchema),
  scope: z.literal("organization"),
  organizationId: z.string(),
  snapshotYearApplied: z.number().int().nullable(),
  availableYears: z.array(z.number().int()),
  overallPercentage: z.number().finite().nullable(),
  cycleId: z.string().nullable(),
  formId: z.string().nullable(),
  formName: z.string().nullable(),
  cycleState: z.string().nullable(),
  isOfficialScore: z.boolean(),
  applicableQuestions: z.number().finite(),
  waivedQuestions: z.number().finite(),
  notApplicableResponses: z.number().finite(),
  calculatedAt: z.string().nullable(),
});

const dashboardEvidenceStatusSchema = apiResponseSchema({
  data: z.record(z.string(), z.number().finite()),
  scope: z.enum(["global", "organization"]),
  organizationId: z.string().nullable(),
});

export type DashboardMaturityResponse = {
  items: AxisMaturity[];
  scope: "organization";
  organizationId: string;
  snapshotYearApplied: number | null;
  availableYears: number[];
  /** Resultado FAMI do diagnóstico mais recente da organização selecionada. */
  overallPercentage: number | null;
  cycleId: string | null;
  formId: string | null;
  formName: string | null;
  cycleState: string | null;
  isOfficialScore: boolean;
  applicableQuestions: number;
  waivedQuestions: number;
  notApplicableResponses: number;
  calculatedAt: string | null;
};

export async function fetchDashboardMaturityByAxis(
  organizationId: string,
  options?: { year?: number | null },
): Promise<DashboardMaturityResponse> {
  const params = new URLSearchParams();
  params.set("organizationId", organizationId);
  if (options?.year != null && Number.isFinite(options.year)) params.set("year", String(options.year));
  const qs = params.toString();
  const res = await fetch(`/api/admin/dashboard/maturity-by-axis${qs ? `?${qs}` : ""}`, {
    headers: buildHeaders(),
  });
  const body = await parseJson(res, dashboardMaturitySchema);
  if (!res.ok) throw new Error(formatError(body, "Falha ao carregar maturidade."));
  return body;
}

export type DashboardEvidenceStatusResponse = {
  data: Record<string, number>;
  scope: "global" | "organization";
  organizationId: string | null;
};

export async function fetchDashboardEvidenceStatus(
  organizationId: string | null,
): Promise<DashboardEvidenceStatusResponse> {
  const qs = organizationId ? new URLSearchParams({ organizationId }).toString() : "";
  const res = await fetch(`/api/admin/dashboard/evidence-status${qs ? `?${qs}` : ""}`, {
    headers: buildHeaders(),
  });
  const body = await parseJson(res, dashboardEvidenceStatusSchema);
  if (!res.ok) throw new Error(formatError(body, "Falha ao carregar o status das evidências."));
  return body;
}
