import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { listCycles, type CycleListItem } from "@/features/cycles/server";

export type FamiCycleOptionRead = {
  id: string;
  organizationId: string;
  formId: string;
  formName: string;
  formVersion: number;
  periodLabel: string;
  closedAt: string | null;
};

type CompletedProcessing = {
  id: string;
  cycleId: string;
  processingVersion: number;
  completedAt: string | null;
};

const completedProcessingSchema = z.object({
  id: z.string().min(1),
  cycle_id: z.string().min(1),
  processing_version: z.coerce.number().int().positive(),
  completed_at: z.string().nullable(),
});

/**
 * Seleciona somente ciclos que possuem ao menos um processamento concluído e
 * uma linha global FAMI. O estado atual do ciclo não participa da decisão:
 * ciclos reabertos continuam disponíveis como histórico oficial.
 */
export function buildFamiCycleOptions(
  cycles: CycleListItem[],
  completedProcessings: CompletedProcessing[],
  processingIdsWithGlobalResult: Set<string>,
): FamiCycleOptionRead[] {
  const latestByCycle = new Map<string, CompletedProcessing>();
  for (const processing of completedProcessings) {
    if (!processingIdsWithGlobalResult.has(processing.id)) continue;
    const current = latestByCycle.get(processing.cycleId);
    if (!current || processing.processingVersion > current.processingVersion) {
      latestByCycle.set(processing.cycleId, processing);
    }
  }

  return cycles.flatMap((cycle) => {
    const latest = latestByCycle.get(cycle.id);
    if (!latest) return [];
    return [{
      id: cycle.id,
      organizationId: cycle.organizationId,
      formId: cycle.formId,
      formName: cycle.formName,
      formVersion: cycle.formVersion,
      periodLabel: cycle.periodLabel,
      closedAt: latest.completedAt ?? cycle.closedAt,
    }];
  });
}

export async function listFamiCycleOptions(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<FamiCycleOptionRead[]> {
  const cycles = await listCycles(supabase, { organizationId });
  if (!cycles.length) return [];

  const { data: processingData, error: processingError } = await supabase
    .from("cycle_processings")
    .select("id, cycle_id, processing_version, completed_at")
    .in("cycle_id", cycles.map((cycle) => cycle.id))
    .eq("status", "completed");
  if (processingError) throw processingError;

  const processings = z.array(completedProcessingSchema).parse(processingData ?? []).map((row) => ({
    id: row.id,
    cycleId: row.cycle_id,
    processingVersion: row.processing_version,
    completedAt: row.completed_at,
  }));
  if (!processings.length) return [];

  const { data: globalData, error: globalError } = await supabase
    .from("fami_results")
    .select("cycle_processing_id")
    .in("cycle_processing_id", processings.map((processing) => processing.id))
    .eq("scope_type", "global");
  if (globalError) throw globalError;

  const processingIdsWithGlobalResult = new Set(
    (globalData ?? []).map((row) => row.cycle_processing_id as string).filter(Boolean),
  );
  return buildFamiCycleOptions(cycles, processings, processingIdsWithGlobalResult);
}
