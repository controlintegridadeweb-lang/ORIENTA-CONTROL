import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { z } from "zod";
import { ExceptionsService } from "@/features/library/server";

const ROUTE = "/api/admin/library/exceptions";

export const GET = withRoute(
  { roles: ["admin"], route: ROUTE, logMessage: "Failed to list recommendation exceptions" },
  async ({ request }) => {
    const requestedOrg = z.string().uuid().parse(
      new URL(request.url).searchParams.get("organizationId"),
    );
    const rows = await new ExceptionsService().listByOrg(requestedOrg);
    return NextResponse.json({ exceptions: rows });
  },
);
