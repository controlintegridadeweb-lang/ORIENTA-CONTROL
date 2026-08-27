import "server-only";

import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";
import type { Bimester } from "@/shared/domain/calendar-periods";
import { listBimonthlyReports } from "./read";

export async function materializeBimonthlyReport(
  client: TypedSupabaseClient,
  input: {
    cycleId: string;
    referenceYear: number;
    bimester: Bimester;
    actorUserId: string | null;
  },
) {
  const { data, error } = await client.rpc("materialize_action_plan_bimonthly_report", {
    p_cycle_id: input.cycleId,
    p_reference_year: input.referenceYear,
    p_bimester: input.bimester,
    p_actor_user_id: input.actorUserId,
  });
  if (error) throw error;
  const history = await listBimonthlyReports(client, input.cycleId, input.referenceYear);
  return { materialized: data, ...history };
}
