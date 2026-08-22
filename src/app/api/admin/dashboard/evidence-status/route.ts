import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import {
  evidenceStatusBreakdown,
  evidenceStatusBreakdownGlobal,
} from "@/features/dashboard/queries";

const querySchema = z.object({
  organizationId: z.string().uuid().optional(),
});

export const GET = withRoute(
  {
    roles: ["admin"],
    route: "/api/admin/dashboard/evidence-status",
    logMessage: "Failed to load dashboard evidence status",
    internalErrorMessage: "Falha ao carregar os indicadores de evidências.",
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const rawOrganizationId = url.searchParams.get("organizationId");
    const parsed = querySchema.safeParse({
      organizationId:
        rawOrganizationId && rawOrganizationId.length > 0
          ? rawOrganizationId
          : undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const organizationId = parsed.data.organizationId;
    const data = organizationId
      ? await evidenceStatusBreakdown(organizationId)
      : await evidenceStatusBreakdownGlobal();

    return NextResponse.json({
      data,
      scope: organizationId ? ("organization" as const) : ("global" as const),
      organizationId: organizationId ?? null,
    });
  },
);
