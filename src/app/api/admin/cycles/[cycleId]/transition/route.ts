import { NextResponse } from "next/server";
import { z } from "zod";
import { DomainConflictError } from "@/infrastructure/api/domain-errors";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { resolveAuthorizedCycleScope } from "@/features/cycles/authorized-cycle";
import { CycleStateService } from "@/features/cycles/cycle-state-service";
import { CycleClosureService } from "@/application/reporting/cycle-closure-service";
import { TRANSITION_EFFECT } from "@/shared/domain/workflow";
import type { CycleState } from "@/shared/domain/types";

const cycleStateSchema = z.enum([
  "draft",
  "in_response",
  "submitted",
  "in_validation",
  "awaiting_adjustment",
  "validated",
  "completed",
]);

const bodySchema = z
  .object({
    to: cycleStateSchema,
    reopenReason: z.string().optional(),
    reopenResponseDeadlineAt: z.string().optional(),
    validationReopenReason: z.string().optional(),
  })
  .strict();

export const POST = withRoute<{ cycleId: string }>(
  {
    roles: ["admin"],
    route: "/api/admin/cycles/[cycleId]/transition",
    logMessage: "Failed to transition cycle",
    internalErrorMessage: "Não foi possível alterar o estado do diagnóstico.",
  },
  async ({ request, auth, params }) => {
    const cycleId = requireUuid(params.cycleId, "cycleId");
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createSupabaseServiceRoleClient();
    const authorized = await resolveAuthorizedCycleScope(supabase, auth, cycleId);
    if (authorized.error) return authorized.error;

    const service = new CycleStateService(supabase);
    const cycle = await service.require(cycleId);
    const to = parsed.data.to as CycleState;
    const effect = TRANSITION_EFFECT[`${cycle.state}->${to}`] ?? null;

    let updated;
    let report = null;
    if (effect === "reopen_validation") {
      const reason = parsed.data.validationReopenReason?.trim() ?? "";
      if (reason.length < 10) {
        throw new DomainConflictError(
          "Informe uma justificativa com pelo menos 10 caracteres para reabrir a validação.",
        );
      }
      updated = await service.reopenValidation(cycleId, auth.userId, { reason });
    } else if (effect === "reopen") {
      const reason = parsed.data.reopenReason?.trim() ?? "";
      const responseDeadlineAt = parsed.data.reopenResponseDeadlineAt ?? "";
      if (reason.length < 10) {
        throw new DomainConflictError(
          "Informe uma justificativa com pelo menos 10 caracteres para reabrir o diagnóstico.",
        );
      }
      if (!responseDeadlineAt) {
        throw new DomainConflictError("Informe um novo prazo futuro para a reabertura.");
      }
      updated = await service.reopen(cycleId, auth.userId, {
        reason,
        responseDeadlineAt,
      });
    } else if (to === "completed") {
      const closure = await new CycleClosureService(supabase).closeAndEmit(
        cycle,
        auth.userId,
      );
      updated = closure.cycle;
      report = closure.report;
    } else {
      updated = await service.transition(cycle, to, auth.userId);
    }

    return NextResponse.json({
      cycle: {
        id: updated.id,
        from: cycle.state,
        to: updated.state,
      },
      closed: updated.state === "completed" && cycle.state !== "completed",
      report,
    });
  },
);
