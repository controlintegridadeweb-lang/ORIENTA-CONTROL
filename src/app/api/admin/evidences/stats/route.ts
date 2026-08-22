import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { EvidencesAdminService } from "@/features/evidences/admin-service";
import { evidenceStatsFiltersFromSearchParams } from "@/features/evidences/http-filters";

export const GET = withRoute(
  { roles: ["admin"], route: "/api/admin/evidences/stats", logMessage: "Failed to load evidence stats" },
  async ({ request, auth }) => {
    const raw = evidenceStatsFiltersFromSearchParams(
      new URL(request.url).searchParams,
    );
    const result = await new EvidencesAdminService().getStats(raw, {
      role: auth.role,
      organizationId: auth.organizationId,
    });
    return NextResponse.json(result);
  },
);
