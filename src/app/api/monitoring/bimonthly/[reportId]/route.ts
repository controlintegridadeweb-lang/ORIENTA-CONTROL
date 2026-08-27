import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import { ensureOrganizationAccess } from "@/infrastructure/api/tenant-guard";
import { ensureRespondentAssignmentAccess } from "@/features/forms/assignments/http";
import { resolveCycleOperationalScope } from "@/infrastructure/supabase/cycle-operational-scope";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { loadBimonthlyReportDetail } from "@/features/improvement-management/monitoring/bimonthly/detail";

export const GET = withRoute<{ reportId: string }>(
  {
    roles: ["admin", "respondent"],
    route: "/api/monitoring/bimonthly/[reportId]",
    internalErrorMessage: "Falha ao carregar o relatório bimestral.",
  },
  async ({ auth, params }) => {
    const parsed = z.string().uuid().safeParse(params.reportId);
    if (!parsed.success) {
      return NextResponse.json({ error: "Relatório inválido." }, { status: 400 });
    }

    const client = createSupabaseServiceRoleClient();
    const tenantOrganizationId = auth.role === "admin" ? undefined : auth.organizationId ?? undefined;
    const detail = await loadBimonthlyReportDetail(client, parsed.data, tenantOrganizationId);
    if (!detail) {
      return NextResponse.json({ error: "Relatório não encontrado." }, { status: 404 });
    }

    const scope = await resolveCycleOperationalScope(client, detail.cycleId);
    if (!scope) {
      return NextResponse.json({ error: "Diagnóstico não encontrado." }, { status: 404 });
    }
    const tenantError = ensureOrganizationAccess(auth, scope.cycle.organizationId);
    if (tenantError) return tenantError;
    const assignmentError = await ensureRespondentAssignmentAccess(
      auth.role,
      scope.formId,
      scope.cycle.organizationId,
    );
    if (assignmentError) return assignmentError;

    return NextResponse.json(detail, {
      headers: { "Cache-Control": "private, no-store" },
    });
  },
);
