import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { listCycles } from "@/features/cycles/cycle-queries";
import { ensureOrganizationAccess } from "@/infrastructure/api/tenant-guard";
import { isGlobalAdmin } from "@/infrastructure/auth/scope";
import type { CycleState } from "@/shared/domain/types";

const CYCLE_STATES = [
  "draft",
  "in_response",
  "submitted",
  "in_validation",
  "awaiting_adjustment",
  "validated",
  "completed",
] as const;

const filtersSchema = z.object({
  organizationId: z.string().uuid().optional(),
  formId: z.string().uuid().optional(),
  periodLabel: z.string().trim().min(1).optional(),
  state: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",").map((v) => v.trim()) : undefined))
    .pipe(z.array(z.enum(CYCLE_STATES)).optional()),
});

export const GET = withRoute(
  {
    roles: ["admin"],
    route: "/api/admin/cycles",
    logMessage: "Failed to list cycles",
  },
  async ({ request, auth }) => {
    const url = new URL(request.url);
    const parsed = filtersSchema.safeParse({
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      formId: url.searchParams.get("formId") ?? undefined,
      periodLabel: url.searchParams.get("periodLabel") ?? undefined,
      state: url.searchParams.get("state") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Filtros inválidos.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const requestedOrganizationId = parsed.data.organizationId;
    if (requestedOrganizationId) {
      const tenantError = ensureOrganizationAccess(auth, requestedOrganizationId);
      if (tenantError) return tenantError;
    }

    // Administradores vinculados não podem ampliar a consulta pelo parâmetro
    // de URL: a própria organização do perfil é sempre o filtro efetivo.
    const effectiveOrganizationId = isGlobalAdmin(auth)
      ? requestedOrganizationId
      : auth.organizationId!;

    const supabase = createSupabaseServiceRoleClient();
    const cycles = await listCycles(supabase, {
      organizationId: effectiveOrganizationId,
      formId: parsed.data.formId,
      periodLabel: parsed.data.periodLabel,
      states: parsed.data.state as CycleState[] | undefined,
    });

    return NextResponse.json({ cycles, count: cycles.length });
  },
);
