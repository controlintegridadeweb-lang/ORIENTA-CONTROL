import "server-only";

import { z } from "zod";
import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";

const impactRowSchema = z.object({
  action_plan_count: z.coerce.number().int().nonnegative(),
  supervision_note_count: z.coerce.number().int().nonnegative(),
  exception_count: z.coerce.number().int().nonnegative(),
});

export type ValidationReopenImpact = {
  actionPlanCount: number;
  supervisionNoteCount: number;
  exceptionCount: number;
  blocked: boolean;
};

export async function getValidationReopenImpact(
  client: TypedSupabaseClient,
  cycleId: string,
): Promise<ValidationReopenImpact> {
  const { data, error } = await client.rpc("validation_reopen_impact", {
    p_cycle_id: cycleId,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (row == null) {
    return {
      actionPlanCount: 0,
      supervisionNoteCount: 0,
      exceptionCount: 0,
      blocked: false,
    };
  }

  const parsed = impactRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new Error("O impacto da reabertura retornou um contrato inválido.");
  }

  const actionPlanCount = parsed.data.action_plan_count;
  const supervisionNoteCount = parsed.data.supervision_note_count;
  const exceptionCount = parsed.data.exception_count;
  return {
    actionPlanCount,
    supervisionNoteCount,
    exceptionCount,
    blocked:
      actionPlanCount > 0 || supervisionNoteCount > 0 || exceptionCount > 0,
  };
}
