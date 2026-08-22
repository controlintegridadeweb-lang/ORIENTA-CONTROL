import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { chunkValues, collectPostgrestPages } from "@/infrastructure/supabase/pagination";

const candidateCycleSchema = z.object({
  id: z.string().uuid(),
  state: z.enum(["validated", "completed"]),
});

const processingSchema = z.object({
  id: z.string().uuid(),
  cycle_id: z.string().uuid(),
  processing_version: z.number().int().positive(),
  status: z.literal("completed"),
});

export type CurrentOfficialProcessingFilters = {
  cycleId?: string;
  organizationId?: string;
  formId?: string;
};

type ProcessingCandidate = z.infer<typeof processingSchema>;

/**
 * Seleciona o processamento concluído mais recente. Pela regra canônica, ciclos
 * `validated` e `completed` nunca possuem processamento oficial em `working`.
 */
export function selectCurrentOfficialProcessingId(
  candidates: ProcessingCandidate[],
): string | null {
  return candidates
    .sort((a, b) => b.processing_version - a.processing_version)[0]?.id ?? null;
}

/**
 * Resolve a única versão de recomendações que pode aparecer como atual.
 *
 * - `validated`: a última versão concluída na validação;
 * - `completed`: a mesma versão oficial, agora com o ciclo encerrado;
 * - outros estados: nenhuma recomendação é oficial para a jornada atual.
 *
 * Processamentos anteriores são preservados para auditoria e relatórios, mas
 * não reaparecem como recomendações ativas após uma reabertura do diagnóstico.
 */
export async function resolveCurrentOfficialProcessingIds(
  client: SupabaseClient,
  filters: CurrentOfficialProcessingFilters = {},
): Promise<Set<string>> {
  const cycleData = await collectPostgrestPages((from, to) => {
    let cyclesQuery = client
      .from("cycles")
      .select("id, state, form_versions!inner(form_id)")
      .in("state", ["validated", "completed"])
      .order("id", { ascending: true });

    if (filters.cycleId) cyclesQuery = cyclesQuery.eq("id", filters.cycleId);
    if (filters.organizationId) {
      cyclesQuery = cyclesQuery.eq("organization_id", filters.organizationId);
    }
    if (filters.formId) {
      cyclesQuery = cyclesQuery.eq("form_versions.form_id", filters.formId);
    }
    return cyclesQuery.range(from, to);
  });

  const cycles = z.array(candidateCycleSchema).parse(cycleData);
  if (cycles.length === 0) return new Set();

  const cycleIds = cycles.map((cycle) => cycle.id);
  const processingData: unknown[] = [];
  for (const cycleChunk of chunkValues(cycleIds)) {
    processingData.push(
      ...(await collectPostgrestPages((from, to) =>
        client
          .from("cycle_processings")
          .select("id, cycle_id, processing_version, status")
          .in("cycle_id", cycleChunk)
          .eq("status", "completed")
          .order("cycle_id", { ascending: true })
          .order("processing_version", { ascending: true })
          .range(from, to),
      )),
    );
  }

  const byCycle = new Map<string, ProcessingCandidate[]>();
  for (const processing of z.array(processingSchema).parse(processingData)) {
    const rows = byCycle.get(processing.cycle_id) ?? [];
    rows.push(processing);
    byCycle.set(processing.cycle_id, rows);
  }

  const ids = new Set<string>();
  for (const cycle of cycles) {
    const currentId = selectCurrentOfficialProcessingId(
      byCycle.get(cycle.id) ?? [],
    );
    if (currentId) ids.add(currentId);
  }

  return ids;
}

export async function isCurrentOfficialProcessing(
  client: SupabaseClient,
  cycleId: string,
  cycleProcessingId: string,
): Promise<boolean> {
  const ids = await resolveCurrentOfficialProcessingIds(client, { cycleId });
  return ids.has(cycleProcessingId);
}
