import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import {
  RespondentEvidencesService,
  respondentEvidenceListQuerySchema,
} from "@/features/evidences/respondent-service";

export const GET = withRoute(
  { roles: ["respondent"], route: "/api/respondent/evidences", logMessage: "Failed to list respondent evidences" },
  async ({ request, auth }) => {
    const organizationId = auth.organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { error: "Sua conta não está vinculada a uma organização." },
        { status: 400 },
      );
    }
    const sp = new URL(request.url).searchParams;
    const query = respondentEvidenceListQuerySchema.parse({
      cycleId: sp.get("cycleId") ?? undefined,
      formId: sp.get("formId") ?? undefined,
      search: sp.get("search") ?? undefined,
      axisName: sp.get("axisName") ?? undefined,
      sectionName: sp.get("sectionName") ?? undefined,
      status: sp.get("status") ?? undefined,
      pendingOnly: sp.get("pendingOnly") ?? undefined,
      limit: sp.get("limit") ?? undefined,
      offset: sp.get("offset") ?? undefined,
    });
    const result = await new RespondentEvidencesService().list({ organizationId }, query);
    return NextResponse.json(result);
  },
);
