import { NextResponse } from "next/server";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { FormsAnswersService } from "@/features/forms/answers-service";

export const GET = withRoute<{ cycleId: string }>(
  { roles: ["admin"], route: "/api/admin/cycles/[cycleId]/answers" },
  async ({ params }) => {
    const cycleId = requireUuid(params.cycleId, "cycleId");
    const detail = await new FormsAnswersService().getRespondentDetail(cycleId);
    return NextResponse.json({ detail });
  },
);
