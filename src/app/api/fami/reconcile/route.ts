import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureOrganizationAccess } from "@/infrastructure/api/tenant-guard";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { CycleStateService } from "@/features/cycles/cycle-state-service";
import {
  FamiProcessingNotFoundError,
  reconcileCycleFami,
} from "@/features/cycles/commit/reconcile";
import { withRoute } from "@/infrastructure/api/with-route";

const payloadSchema = z
  .object({
    cycleId: z.string().uuid(),
    cycleProcessingId: z.string().uuid().optional(),
    dryRun: z.literal(true),
  })
  .strict();

/**
 * Conferência read-only do FAMI oficial.
 *
 * Apesar de não persistir dados, usa POST por receber um payload estruturado.
 * Passa pelo wrapper autenticado para aplicar MFA, CSRF, rate limit e o
 * tratamento uniforme de erros.
 */
export const POST = withRoute(
  {
    roles: ["admin"],
    route: "/api/fami/reconcile",
    internalErrorMessage: "Falha ao conferir o Resultado FAMI.",
    extraErrorHandlers: [
      (error) =>
        error instanceof FamiProcessingNotFoundError
          ? NextResponse.json({ error: error.message }, { status: 409 })
          : null,
    ],
  },
  async ({ request, auth }) => {
    const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createSupabaseServiceRoleClient();
    const cycle = await new CycleStateService(supabase).find(parsed.data.cycleId);

    if (!cycle) {
      return NextResponse.json({ error: "Diagnóstico não encontrado." }, { status: 404 });
    }

    const tenantError = ensureOrganizationAccess(auth, cycle.organizationId);
    if (tenantError) return tenantError;

    const result = await reconcileCycleFami(supabase, {
      cycleId: cycle.id,
      cycleProcessingId: parsed.data.cycleProcessingId,
    });

    return NextResponse.json({
      reconcileOnly: true,
      persisted: false,
      cycleId: result.cycleId,
      cycleProcessingId: result.cycleProcessingId,
      processingVersion: result.processingVersion,
      policyVersion: result.policy.version,
      recalculated: result.recalculated,
      stored: result.stored,
      scopes: result.scopes,
      matches: result.matches,
    });
  },
);
