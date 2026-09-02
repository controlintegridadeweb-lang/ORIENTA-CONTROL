import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import { ensureOrganizationAccess } from "@/infrastructure/api/tenant-guard";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import {
  mapHistoryEntry,
  REPORT_HISTORY_SELECT,
  reportCatalogKindSchema,
  reportHistoryEntrySchema,
  selectLatestVisibleHistoryEntries,
} from "./history-catalog";

const querySchema = z.object({
  organizationId: z.string().uuid().optional(),
  cycleId: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["current", "historical"]).optional(),
  kind: reportCatalogKindSchema.optional(),
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

/** Histórico paginado do catálogo anual + bimestral. A view já devolve só a emissão mais recente de cada grupo; filtros e contagem aplicam-se a esse conjunto. */
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
      .select(REPORT_HISTORY_SELECT, { count: "exact" })
      .eq("organization_id", organizationId);

    if (query.cycleId) statement = statement.eq("cycle_id", query.cycleId);
    if (query.search) {
      const term = `%${query.search.replaceAll('"', "")}%`;
      statement = statement.or(`form_name.ilike."${term}",period_label.ilike."${term}"`);
    }
    if (query.status === "current") statement = statement.eq("is_current", true);
    if (query.status === "historical") statement = statement.eq("is_current", false);
    if (query.kind) statement = statement.eq("report_kind", query.kind);
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

    const rows = selectLatestVisibleHistoryEntries(
      z.array(reportHistoryEntrySchema).parse(data ?? []),
    );
    const { data: years, error: yearsError } = await supabase
      .from("report_history_years")
      .select("calendar_year")
      .eq("organization_id", organizationId)
      .order("calendar_year", { ascending: false });
    if (yearsError) throw yearsError;

    const total = count ?? 0;
    return NextResponse.json({
      viewerUserId: auth.role === "respondent" ? auth.userId : null,
      items: rows.map(mapHistoryEntry),
      total,
      limit: query.limit,
      offset: query.offset,
      hasMore: query.offset + rows.length < total,
      availableYears: (years ?? []).map((row) => Number(row.calendar_year)).filter(Number.isInteger),
    });
  },
);
