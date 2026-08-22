import { NextResponse } from "next/server";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { ExceptionsService } from "@/features/library/server";

export const PATCH = withRoute<{ id: string }>(
  { roles: ["admin"], route: "/api/admin/library/exceptions/[id]", logMessage: "Failed to decide recommendation exception" },
  async ({ request, auth, params }) => {
    const id = requireUuid(params.id, "id");
    const exception = await new ExceptionsService().decide(id, await request.json(), { userId: auth.userId });
    return NextResponse.json({ exception });
  },
);
