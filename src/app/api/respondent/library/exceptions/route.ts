import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { ExceptionsService } from "@/features/library/exceptions-service";

const ROUTE = "/api/respondent/library/exceptions";


export const GET = withRoute(
  {
    roles: ["respondent"],
    route: ROUTE,
    logMessage: "Failed to list respondent recommendation exceptions",
  },
  async ({ auth }) => {
    if (!auth.organizationId) {
      return NextResponse.json({ error: "Perfil sem organização vinculada." }, { status: 403 });
    }
    const exceptions = await new ExceptionsService().listByOrg(auth.organizationId);
    return NextResponse.json({ exceptions });
  },
);

/** Solicita uma exceção institucional exclusivamente no escopo do respondente. */
export const POST = withRoute(
  {
    roles: ["respondent"],
    route: ROUTE,
    logMessage: "Failed to request recommendation exception",
  },
  async ({ request, auth }) => {
    if (!auth.organizationId) {
      return NextResponse.json(
        { error: "Perfil sem organização vinculada." },
        { status: 403 },
      );
    }

    const rawBody: unknown = await request.json();
    const body = rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
      ? { ...(rawBody as Record<string, unknown>) }
      : {};
    const requestedOrganizationId =
      typeof body.organizationId === "string" ? body.organizationId : null;
    if (
      requestedOrganizationId &&
      requestedOrganizationId !== auth.organizationId
    ) {
      return NextResponse.json(
        { error: "Não autorizado a abrir exceção em outra organização." },
        { status: 403 },
      );
    }

    body.organizationId = auth.organizationId;
    const exception = await new ExceptionsService().request(body, {
      userId: auth.userId,
    });
    return NextResponse.json({ exception }, { status: 201 });
  },
);
