import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { RecommendationsAdminService } from "@/features/improvement-management/recommendations/admin-service";

export const GET = withRoute(
  {
    roles: ["admin", "respondent"],
    route: "/api/recommendations/filters",
    logMessage: "Failed to list recommendation filters",
  },
  async ({ auth }) => {
    const filters = await new RecommendationsAdminService().listFilterOptions({
      role: auth.role,
      organizationId: auth.organizationId,
    });
    return NextResponse.json(filters);
  },
);
