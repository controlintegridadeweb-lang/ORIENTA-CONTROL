import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const blockersSchema = z.object({
  pendingEvidence: z.number().int().nonnegative(),
  pendingNotApplicable: z.number().int().nonnegative(),
  undecidedAbsentProof: z.number().int().nonnegative(),
  incompleteResponses: z.number().int().nonnegative(),
  missingRecommendations: z.number().int().nonnegative(),
  missingWorkingProcessing: z.boolean(),
});

const readinessRowSchema = z.object({
  cycle_id: z.string().uuid(),
  ready: z.boolean(),
  blockers: blockersSchema,
});

export type ValidationFinalizationReadiness = {
  cycleId: string;
  ready: boolean;
  blockers: z.infer<typeof blockersSchema>;
};

export async function loadValidationFinalizationReadiness(
  supabase: SupabaseClient,
  cycleIds: string[],
): Promise<ValidationFinalizationReadiness[]> {
  const uniqueCycleIds = [...new Set(cycleIds)];
  if (uniqueCycleIds.length === 0) return [];

  const { data, error } = await supabase.rpc(
    "list_validation_finalization_readiness",
    { p_cycle_ids: uniqueCycleIds },
  );
  if (error) throw error;

  return z.array(readinessRowSchema).parse(data ?? []).map((row) => ({
    cycleId: row.cycle_id,
    ready: row.ready,
    blockers: row.blockers,
  }));
}
