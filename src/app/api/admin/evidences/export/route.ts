import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { EvidencesAdminService } from "@/features/evidences/admin-service";
import { evidenceExportFiltersFromSearchParams } from "@/features/evidences/http-filters";
import { buildEvidencesCsv, buildEvidencesPdf } from "@/features/evidences/export";
import { evidenceExportFormatSchema } from "@/features/evidences/schemas";
import { aggregateKpiCounts } from "@/features/evidences/status-groups";

export const GET = withRoute(
  { roles: ["admin"], route: "/api/admin/evidences/export", logMessage: "Failed to export evidences" },
  async ({ request, auth }) => {
    const sp = new URL(request.url).searchParams;
    const fmtParsed = evidenceExportFormatSchema.safeParse(sp.get("format"));
    if (!fmtParsed.success) {
      return NextResponse.json({ error: "Informe format=csv ou format=pdf." }, { status: 400 });
    }
    const format = fmtParsed.data;
    const raw = evidenceExportFiltersFromSearchParams(sp);
    const items = await new EvidencesAdminService().listForExport(raw, {
      role: auth.role,
      organizationId: auth.organizationId,
    });
    const stats = aggregateKpiCounts(items);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

    if (format === "csv") {
      return new NextResponse(buildEvidencesCsv(items), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="evidencias-${stamp}.csv"`,
        },
      });
    }

    const bytes = await buildEvidencesPdf({
      items,
      stats,
      generatedAtIso: new Date().toISOString(),
    });
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="evidencias-${stamp}.pdf"`,
      },
    });
  },
);
