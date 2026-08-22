import { NextResponse } from "next/server";
import { z } from "zod";
import { DomainValidationError } from "@/infrastructure/api/domain-errors";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { resolveAuthorizedCycleScope, updateCycleSchedule } from "@/features/cycles/server";

const instant = z.string().datetime({ offset: true }).nullable();
const schema = z.object({
  startsAt: instant.optional(),
  responseDeadlineAt: instant.optional(),
  validationDeadlineAt: instant.optional(),
  cycleCloseAt: instant.optional(),
}).strict().refine((v: Record<string, unknown>) => Object.keys(v).length > 0, { message: "Informe ao menos um campo para atualização." });

export const PATCH = withRoute<{ cycleId: string }>(
  { roles: ["admin"], route: "/api/admin/cycles/[cycleId]", logMessage: "Failed to update cycle schedule" },
  async ({ request, auth, params }) => {
    const cycleId = requireUuid(params.cycleId, "cycleId");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new DomainValidationError(parsed.error.issues.map((i: { path: PropertyKey[]; message: string }) => ({ path: i.path.join(".") || "_", message: i.message })));
    const supabase = createSupabaseServiceRoleClient();
    const authorized = await resolveAuthorizedCycleScope(supabase, auth, cycleId);
    if (authorized.error) return authorized.error;
    const cycle = await updateCycleSchedule(supabase, cycleId, { ...parsed.data, actorUserId: auth.userId });
    return NextResponse.json({ cycle });
  },
);
