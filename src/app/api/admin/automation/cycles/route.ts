import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import {
  lifecycleBatchActionSchema,
  runLifecycleBatch,
} from "@/application/automation/batch-lifecycle-service";

const bodySchema = z.object({
  action: lifecycleBatchActionSchema,
  cycleIds: z.array(z.string().uuid()).min(1).max(500),
}).strict();

export const POST = withRoute(
  {
    roles: ["admin"],
    route: "/api/admin/automation/cycles",
    logMessage: "Failed to process lifecycle batch",
  },
  async ({ request, auth }) => {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, { status: 400 });
    }
    const result = await runLifecycleBatch({ ...parsed.data, actorUserId: auth.userId });
    return NextResponse.json(result);
  },
);
