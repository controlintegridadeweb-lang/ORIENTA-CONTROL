import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import { ensureOrganizationAccess } from "@/infrastructure/api/tenant-guard";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";

const querySchema = z.object({
  organizationId: z.string().uuid().optional(),
  cycleId: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["current", "historical"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  referenceYear: z.coerce.number().int().min(1900).max(2199).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
}).superRefine((value, ctx) => {
  if (value.from && value.to && value.from > value.to) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "A data final deve ser igual ou posterior à data inicial." });
  }
});

const entrySchema = z.object({
  id: z.string().uuid(),
  cycle_id: z.string().uuid(),
  cycle_processing_id: z.string().uuid(),
  generated_by: z.string().uuid().nullable(),
  generated_by_name: z.string().nullable(),
  generated_at: z.string(),
  emission_version: z.number().int().positive(),
  reissue_reason: z.string().nullable(),
  processing_version: z.number().int().positive(),
  fami_policy_version: z.string().min(1),
  organization_id: z.string().uuid(),
  period_label: z.string().nullable(),
  form_id: z.string().uuid(),
  form_version: z.number().int().positive(),
  form_name: z.string(),
  latest_processing_version: z.number().int().positive(),
  latest_emission_version: z.number().int().positive(),
  is_current: z.boolean(),
  file_sha256: z.string().nullable(),
  content_sha256: z.string().nullable(),
  file_size_bytes: z.number().nullable(),
  reference_start_year: z.number().int().nullable(),
  reference_end_year: z.number().int().nullable(),
  cycle_state: z.string(),
  report_action_plan_revision: z.number().nullable(),
  current_action_plan_revision: z.number(),
  current_reference_start_year: z.number().int().nullable(),
  current_reference_end_year: z.number().int().nullable(),
});

/** Histórico oficial paginado. A contagem e a condição "atual" vêm do banco. */
export const GET = withRoute(
  { roles: ["admin", "respondent"], route: "/api/reports/history", logMessage: "Failed to list report history" },
  async ({ request, auth }) => {
    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams));
    const organizationId = auth.role === "respondent" ? auth.organizationId : query.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "Selecione uma organização para consultar o histórico." }, { status: 400 });
    }
    const tenantError = ensureOrganizationAccess(auth, organizationId);
    if (tenantError) return tenantError;

    const supabase = createSupabaseServiceRoleClient();
    let statement = supabase
      .from("report_history_entries")
      .select(
        "id,cycle_id,cycle_processing_id,generated_by,generated_by_name,generated_at,emission_version,reissue_reason,processing_version,fami_policy_version,organization_id,period_label,form_id,form_version,form_name,latest_processing_version,latest_emission_version,is_current,file_sha256,content_sha256,file_size_bytes,reference_start_year,reference_end_year,cycle_state,report_action_plan_revision,current_action_plan_revision,current_reference_start_year,current_reference_end_year",
        { count: "exact" },
      )
      .eq("organization_id", organizationId);

    if (query.cycleId) statement = statement.eq("cycle_id", query.cycleId);
    if (query.search) statement = statement.ilike("form_name", `%${query.search}%`);
    if (query.status === "current") statement = statement.eq("is_current", true);
    if (query.status === "historical") statement = statement.eq("is_current", false);
    if (query.from) statement = statement.gte("generated_at", `${query.from}T00:00:00-03:00`);
    if (query.to) statement = statement.lte("generated_at", `${query.to}T23:59:59.999-03:00`);
    if (query.referenceYear != null) {
      statement = statement
        .lte("reference_start_year", query.referenceYear)
        .gte("reference_end_year", query.referenceYear);
    }

    const { data, error, count } = await statement
      .order("generated_at", { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);
    if (error) throw error;

    const rows = z.array(entrySchema).parse(data ?? []);
    const { data: years, error: yearsError } = await supabase
      .from("report_history_years")
      .select("calendar_year")
      .eq("organization_id", organizationId)
      .order("calendar_year", { ascending: false });
    if (yearsError) throw yearsError;

    const total = count ?? 0;
    return NextResponse.json({
      viewerUserId: auth.role === "respondent" ? auth.userId : null,
      items: rows.map((row) => ({
        id: row.id,
        cycleId: row.cycle_id,
        cycleProcessingId: row.cycle_processing_id,
        formId: row.form_id,
        formName: row.form_name,
        formVersion: row.form_version,
        organizationId: row.organization_id,
        periodLabel: row.period_label ?? "",
        processingVersion: row.processing_version,
        policyVersion: row.fami_policy_version,
        latestProcessingVersion: row.latest_processing_version,
        emissionVersion: row.emission_version,
        latestEmissionVersion: row.latest_emission_version,
        isCurrent: row.is_current,
        reissueReason: row.reissue_reason,
        fileSha256: row.file_sha256,
        contentSha256: row.content_sha256,
        fileSizeBytes: row.file_size_bytes,
        referenceStartYear: row.reference_start_year,
        referenceEndYear: row.reference_end_year,
        outdatedReason: row.is_current
          ? null
          : row.cycle_state !== "completed"
            ? "O diagnóstico foi reaberto após esta emissão."
            : row.reference_start_year !== row.current_reference_start_year ||
                row.reference_end_year !== row.current_reference_end_year
              ? "A referência institucional do diagnóstico diverge desta emissão."
              : row.report_action_plan_revision !== row.current_action_plan_revision
                ? "O plano de ação foi alterado após esta emissão."
              : row.processing_version !== row.latest_processing_version
                ? "Existe um processamento posterior deste diagnóstico."
                : row.emission_version !== row.latest_emission_version
                  ? "Esta emissão foi substituída por uma versão posterior."
                  : !row.file_sha256
                    ? "Emissão legada sem verificação criptográfica."
                    : "Esta emissão não representa mais o estado atual do diagnóstico.",
        generatedBy: row.generated_by,
        generatedByLabel: row.generated_by_name?.trim() || "Administração da plataforma",
        generatedAt: row.generated_at,
        downloadPath: `/api/reports/${row.id}/download`,
      })),
      total,
      limit: query.limit,
      offset: query.offset,
      hasMore: query.offset + rows.length < total,
      availableYears: (years ?? []).map((row) => Number(row.calendar_year)).filter(Number.isInteger),
    });
  },
);
