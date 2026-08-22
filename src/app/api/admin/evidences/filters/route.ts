import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { EvidencesAdminService } from "@/features/evidences/admin-service";

export const GET = withRoute(
  { roles: ["admin"], route: "/api/admin/evidences/filters", logMessage: "Failed to list evidence filters" },
  async ({ auth }) => {
    const filters = await new EvidencesAdminService().listFilterOptions({
      role: auth.role,
      organizationId: auth.organizationId,
    });
    return NextResponse.json(filters);
  },
);
