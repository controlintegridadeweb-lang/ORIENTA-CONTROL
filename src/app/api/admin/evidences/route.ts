import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { EvidencesAdminService } from "@/features/evidences/admin-service";
import { evidenceListFiltersFromSearchParams } from "@/features/evidences/http-filters";

export const GET = withRoute(
  { roles: ["admin"], route: "/api/admin/evidences", logMessage: "Failed to list evidences" },
  async ({ request, auth }) => {
    const raw = evidenceListFiltersFromSearchParams(
      new URL(request.url).searchParams,
    );
    const result = await new EvidencesAdminService().list(raw, {
      role: auth.role,
      organizationId: auth.organizationId,
    });
    return NextResponse.json(result);
  },
);
