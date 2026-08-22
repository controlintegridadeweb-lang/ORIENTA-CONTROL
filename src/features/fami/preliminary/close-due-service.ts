import "server-only";

import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";
import {
  parseCloseDuePreliminaryResult,
  type CloseDuePreliminaryResult,
} from "./close-due-result";

export type { CloseDuePreliminaryResult };

export async function closeDuePreliminaryQuadrimesters(
  client: TypedSupabaseClient,
): Promise<CloseDuePreliminaryResult> {
  const { data, error } = await client.rpc("close_due_fami_preliminary_quadrimesters");
  if (error) throw error;
  return parseCloseDuePreliminaryResult(data);
}
