import { NextResponse } from "next/server";
import { internalServerErrorResponse } from "@/infrastructure/api/domain-errors";
import { z } from "zod";
import { requireAuth } from "@/infrastructure/api/auth";
import { ensureOrganizationAccess } from "@/infrastructure/api/tenant-guard";
import { ensureRespondentAssignmentAccess } from "@/features/forms/assignments/http";
import { resolveCycleOperationalScope } from "@/infrastructure/supabase/cycle-operational-scope";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import {
  buildFamiSnapshotForCycleYear,
  getAvailableFamiYearsForCycle,
  getFamiEvolutionByYearForCycle,
  getFamiEvolutionForCycle,
  getFamiSnapshotLatestForCycle,
  getLatestFamiVersionForCycle,
} from "@/features/fami/cycle-fami-read";
import { logError } from "@/infrastructure/observability/logger";

const uuid = z.string().uuid();
const querySchema = z.object({
  cycleId: uuid,
  year: z
    .union([z.coerce.number().int().min(1900).max(2100), z.literal("")])
    .optional()
    .transform((value) => (value === "" || value == null ? undefined : value)),
  evolutionMode: z.enum(["versions", "years"]).optional(),
});

export async function GET(request: Request) {
  const { context, error: authError } = await requireAuth(request, ["admin", "respondent"]);
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    cycleId: url.searchParams.get("cycleId") ?? undefined,
    year: url.searchParams.get("year") ?? undefined,
    evolutionMode: url.searchParams.get("evolutionMode") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { cycleId, year, evolutionMode } = parsed.data;
  const roleContext = context;

  try {
    const operationalScope = await resolveCycleOperationalScope(createSupabaseServiceRoleClient(), cycleId);
    if (!operationalScope) return NextResponse.json({ error: "Diagnóstico não encontrado." }, { status: 404 });
    const tenantError = ensureOrganizationAccess(roleContext, operationalScope.cycle.organizationId);
    if (tenantError) return tenantError;
    const assignmentError = await ensureRespondentAssignmentAccess(
      roleContext.role,
      operationalScope.formId,
      operationalScope.cycle.organizationId,
    );
    if (assignmentError) return assignmentError;

    const mode = evolutionMode ?? "years";
    const [availableYears, latestVersionMeta, evolutionPayload, snapshot] = await Promise.all([
      getAvailableFamiYearsForCycle(cycleId),
      getLatestFamiVersionForCycle(cycleId),
      mode === "versions" ? getFamiEvolutionForCycle(cycleId) : getFamiEvolutionByYearForCycle(cycleId),
      year != null ? buildFamiSnapshotForCycleYear(cycleId, year) : getFamiSnapshotLatestForCycle(cycleId),
    ]);
    return NextResponse.json({
      snapshot,
      evolution: mode === "versions" ? evolutionPayload : [],
      evolutionByYear: mode === "years" ? evolutionPayload : [],
      availableYears,
      latestVersionMeta,
      cycleId,
      evolutionModeUsed: mode,
      yearRequested: year ?? null,
      scopeKind: "cycle",
    });
  } catch (error) {
    logError("Failed to load FAMI snapshot", error, { route: "/api/fami/snapshot" });
    return internalServerErrorResponse("Falha ao carregar o Resultado FAMI.");
  }
}
