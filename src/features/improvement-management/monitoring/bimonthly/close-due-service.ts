import "server-only";

import { z } from "zod";
import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";

export const closeDueBimonthlyResultSchema = z.object({
  ok: z.boolean(),
  closed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  errors: z.array(
    z.object({
      cycleId: z.string().uuid(),
      referenceYear: z.number().int(),
      bimester: z.number().int(),
      quadrimester: z.number().int().optional(),
      error: z.string(),
    }),
  ),
  reason: z.string().optional(),
});

export type CloseDueBimonthlyResult = z.infer<typeof closeDueBimonthlyResultSchema>;

export function parseCloseDueBimonthlyResult(raw: unknown): CloseDueBimonthlyResult {
  const parsed = closeDueBimonthlyResultSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("A rotina de fechamento bimestral retornou um contrato inválido.");
  }
  return parsed.data;
}

export async function closeDueBimonthlyReports(
  client: TypedSupabaseClient,
): Promise<CloseDueBimonthlyResult> {
  const { data, error } = await client.rpc("close_due_action_plan_bimesters");
  if (error) throw error;
  return parseCloseDueBimonthlyResult(data);
}
