import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import { ensureOrganizationAccess } from "@/infrastructure/api/tenant-guard";
import { ensureRespondentAssignmentAccess } from "@/features/forms/assignments/http";
import { resolveCycleOperationalScope } from "@/infrastructure/supabase/cycle-operational-scope";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { loadPreliminaryExportDetail } from "@/features/fami/preliminary/export-detail";
import { generatePreliminaryExportPdf } from "@/features/fami/preliminary/export-pdf";
import { generatePreliminaryExportExcel } from "@/features/fami/preliminary/export-xlsx";

const querySchema = z.object({
  format: z.enum(["pdf", "xlsx"]).default("pdf"),
});

export const GET = withRoute<{ processingId: string }>(
  {
    roles: ["admin", "respondent"],
    route: "/api/fami/preliminary/[processingId]/export",
    internalErrorMessage: "Falha ao exportar o FAMI preliminar.",
  },
  async ({ request, auth, params }) => {
    const parsedId = z.string().uuid().safeParse(params.processingId);
    if (!parsedId.success) {
      return NextResponse.json({ error: "Cálculo inválido." }, { status: 400 });
    }
    const parsedFormat = querySchema.safeParse({
      format: new URL(request.url).searchParams.get("format") ?? "pdf",
    });
    if (!parsedFormat.success) {
      return NextResponse.json({ error: "Formato de exportação inválido." }, { status: 400 });
    }

    const client = createSupabaseServiceRoleClient();
    const detail = await loadPreliminaryExportDetail(client, parsedId.data);
    if (!detail) {
      return NextResponse.json(
        { error: "FAMI preliminar indisponível para exportação." },
        { status: 404 },
      );
    }

    const scope = await resolveCycleOperationalScope(client, detail.checkpoint.cycleId);
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
      const file = await generatePreliminaryExportExcel(detail);
      return new NextResponse(new Uint8Array(file.buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${file.filename}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const file = await generatePreliminaryExportPdf(detail);
    return new NextResponse(Buffer.from(file.content), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  },
);
