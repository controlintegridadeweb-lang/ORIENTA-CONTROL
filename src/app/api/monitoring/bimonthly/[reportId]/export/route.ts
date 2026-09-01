import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import { ensureOrganizationAccess } from "@/infrastructure/api/tenant-guard";
import { ensureRespondentAssignmentAccess } from "@/features/forms/assignments/http";
import { resolveCycleOperationalScope } from "@/infrastructure/supabase/cycle-operational-scope";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { loadBimonthlyReportDetail } from "@/features/improvement-management/monitoring/bimonthly/detail";
import { generateBimonthlyReportExcel } from "@/features/improvement-management/monitoring/bimonthly/export-xlsx";
import { buildBimonthlyTrackingPdf } from "@/features/reports/pdf/build-bimonthly-tracking-pdf";
import { BIMONTHLY_TRACKING_OFFICIAL_BASE_MISSING } from "@/features/reports/pdf/overlay-bimonthly-tracking";

const querySchema = z.object({
  format: z.enum(["pdf", "xlsx"]).default("pdf"),
});

export const GET = withRoute<{ reportId: string }>(
  {
    roles: ["admin", "respondent"],
    route: "/api/monitoring/bimonthly/[reportId]/export",
    internalErrorMessage: "Falha ao exportar o relatório bimestral.",
  },
  async ({ request, auth, params }) => {
    const parsedId = z.string().uuid().safeParse(params.reportId);
    if (!parsedId.success) {
      return NextResponse.json({ error: "Relatório inválido." }, { status: 400 });
    }
    const parsedFormat = querySchema.safeParse({
      format: new URL(request.url).searchParams.get("format") ?? "pdf",
    });
    if (!parsedFormat.success) {
      return NextResponse.json({ error: "Formato de exportação inválido." }, { status: 400 });
    }

    const client = createSupabaseServiceRoleClient();
    const tenantOrganizationId = auth.role === "admin" ? undefined : auth.organizationId ?? undefined;
    const detail = await loadBimonthlyReportDetail(client, parsedId.data, tenantOrganizationId);
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

    if (parsedFormat.data.format === "xlsx") {
      const file = await generateBimonthlyReportExcel(detail);
      return new NextResponse(new Uint8Array(file.buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${file.filename}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    try {
      const file = await buildBimonthlyTrackingPdf({
        snapshot: detail,
        client,
      });
      return new NextResponse(Buffer.from(file.bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${file.filename}"`,
          "Cache-Control": "private, no-store",
        },
      });
    } catch (cause) {
      if (cause instanceof Error && cause.message === BIMONTHLY_TRACKING_OFFICIAL_BASE_MISSING) {
        return NextResponse.json(
          { error: "Não existe Resultado FAMI oficial para montar o relatório bimestral." },
          { status: 409 },
        );
      }
      throw cause;
    }
  },
);
