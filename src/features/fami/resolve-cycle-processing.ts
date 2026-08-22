import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mapeamentos para visões explicitamente agregadas de FAMI.
 *
 * Leituras de uma execução concreta devem receber `cycle_id` ou
 * `cycle_processing_id` e usar os resolvedores `...ForCycle` deste módulo.
 * Nunca use form_id + organization_id + processing_version para escolher um
 * ciclo: processing_version só é única dentro de um ciclo.
 */

type AnyClient = SupabaseClient<never, never, never> | ReturnType<() => unknown>;

/**
 * `cycle_processing_id` de um ciclo específico. Use este resolvedor em fluxos
 * operacionais (relatórios, emissão e conferência) para não escolher por
 * engano um ciclo homônimo do mesmo formulário e organização.
 */
export async function resolveCycleProcessingIdForCycle(
  client: AnyClient,
  cycleId: string,
  processingVersion: number,
): Promise<string | null> {
  const { data, error } = await (client as SupabaseClient)
    .from("cycle_processings")
    .select("id")
    .eq("cycle_id", cycleId)
    .eq("processing_version", processingVersion)
    .maybeSingle();
  if (error) throw error;
  return data ? (data.id as string) : null;
}

export type CycleProcessingMetadata = {
  processingVersion: number;
  policyVersion: string;
  status: "working" | "completed";
  completedAt: string | null;
};

/** Metadados congelados de todos os processamentos pertencentes ao ciclo. */
export async function resolveProcessingMetadataMapForCycle(
  client: AnyClient,
  cycleId: string,
): Promise<Map<string, CycleProcessingMetadata>> {
  const { data, error } = await (client as SupabaseClient)
    .from("cycle_processings")
    .select("id, processing_version, fami_policy_version, status, completed_at")
    .eq("cycle_id", cycleId);
  if (error) throw error;

  return new Map(
    (data ?? []).map((row) => [
      row.id as string,
      {
        processingVersion: Number(row.processing_version),
        policyVersion: String(row.fami_policy_version ?? ""),
        status: row.status === "completed" ? "completed" : "working",
        completedAt: row.completed_at ? String(row.completed_at) : null,
      },
    ]),
  );
}

/** Metadados congelados de um processamento identificado dentro do ciclo. */
export async function resolveCycleProcessingMetadataForCycle(
  client: AnyClient,
  cycleId: string,
  processingVersion: number,
): Promise<(CycleProcessingMetadata & { id: string }) | null> {
  const { data, error } = await (client as SupabaseClient)
    .from("cycle_processings")
    .select("id, processing_version, fami_policy_version, status, completed_at")
    .eq("cycle_id", cycleId)
    .eq("processing_version", processingVersion)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id as string,
    processingVersion: Number(data.processing_version),
    policyVersion: String(data.fami_policy_version ?? ""),
    status: data.status === "completed" ? "completed" : "working",
    completedAt: data.completed_at ? String(data.completed_at) : null,
  };
}
