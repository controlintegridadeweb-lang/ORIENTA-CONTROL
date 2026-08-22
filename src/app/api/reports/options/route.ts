import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import { ensureOrganizationAccess } from "@/infrastructure/api/tenant-guard";
import { listAssignedFormIdsForOrganization } from "@/features/forms/assignments/service";
import { listAllOrganizationOptions } from "@/features/organizations/admin-service";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";

const querySchema = z.object({
  organizationId: z.string().uuid().optional(),
  cycleId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Opções de emissão oficial com busca e paginação reais. Nenhum diagnóstico
 * elegível desaparece silenciosamente do seletor administrativo.
 */
export const GET = withRoute(
  { roles: ["admin", "respondent"], route: "/api/reports/options", logMessage: "Failed to load report options" },
  async ({ request, auth }) => {
    const supabase = createSupabaseServiceRoleClient();
    let organizations: { id: string; name: string }[] = [];

    if (auth.role === "respondent") {
      if (!auth.organizationId) {
        return NextResponse.json({ error: "Usuário sem organização vinculada." }, { status: 403 });
      }
      const { data, error } = await supabase
        .from("organizations")
        .select("id,name")
        .eq("id", auth.organizationId)
        .maybeSingle();
      if (error) throw error;
      organizations = data ? [{ id: data.id, name: data.name }] : [];
    } else {
      organizations = (await listAllOrganizationOptions()).map(({ id, name }) => ({ id, name }));
    }

    const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const organizationId = query.organizationId;
    if (!organizationId) {
      return NextResponse.json({
        organizations,
        cycles: [],
        totalCycles: 0,
        limit: query.limit,
        offset: query.offset,
        hasMoreCycles: false,
      });
    }

    const tenantError = ensureOrganizationAccess(auth, organizationId);
    if (tenantError) return tenantError;
    const assignedFormIds = auth.role === "respondent"
      ? await listAssignedFormIdsForOrganization(organizationId)
      : undefined;

    const { data, error } = await supabase.rpc("list_report_options_page", {
      p_organization_id: organizationId,
      p_cycle_id: query.cycleId,
      p_form_ids: assignedFormIds,
      p_search: query.search?.trim() || undefined,
      p_limit: query.limit,
      p_offset: query.offset,
    });
    if (error) throw error;
    const rows = data ?? [];
    const total = Number(rows[0]?.total_count ?? 0);
    const cycles = rows.map((row) => ({
      cycleId: row.cycle_id,
      formId: row.form_id,
      formName: row.form_name,
      formVersion: Number(row.form_version),
      periodLabel: row.period_label,
      referenceStartYear: row.reference_start_year == null ? null : Number(row.reference_start_year),
      referenceEndYear: row.reference_end_year == null ? null : Number(row.reference_end_year),
      latestProcessingVersion: Number(row.processing_version),
      policyVersion: row.policy_version,
      cycleState: row.cycle_state,
      isHistoricalProcessing: row.cycle_state !== "validated" && row.cycle_state !== "completed",
      emissionCount: Number(row.emission_count),
      latestEmissionVersion: row.latest_emission_version == null ? null : Number(row.latest_emission_version),
      reportStatus: row.report_status,
    }));

    return NextResponse.json({
      organizations,
      cycles,
      totalCycles: total,
      limit: query.limit,
      offset: query.offset,
      hasMoreCycles: query.offset + rows.length < total,
    });
  },
);
