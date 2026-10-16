import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { buildRespondentEvidencesXlsx } from "@/features/evidences/respondent-export-xlsx";
import {
  RespondentEvidencesService,
  respondentEvidenceExportQuerySchema,
} from "@/features/evidences/respondent-service";

export const GET = withRoute(
  {
    roles: ["respondent"],
    route: "/api/respondent/evidences/export",
    logMessage: "Failed to export respondent evidences",
  },
  async ({ request, auth }) => {
    const organizationId = auth.organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { error: "Sua conta não está vinculada a uma organização." },
        { status: 400 },
      );
    }

    const sp = new URL(request.url).searchParams;
    const query = respondentEvidenceExportQuerySchema.parse({
      cycleId: sp.get("cycleId") ?? undefined,
      formId: sp.get("formId") ?? undefined,
      search: sp.get("search") ?? undefined,
      axisName: sp.get("axisName") ?? undefined,
      sectionName: sp.get("sectionName") ?? undefined,
      status: sp.get("status") ?? undefined,
      pendingOnly: sp.get("pendingOnly") ?? undefined,
    });
    const items = await new RespondentEvidencesService().listForExport(
      { organizationId },
      query,
    );
    if (items.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma evidência para exportar com os filtros atuais." },
        { status: 404 },
      );
    }

    const { filename, content } = await buildRespondentEvidencesXlsx(items);
    return new NextResponse(new Uint8Array(content), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  },
);
