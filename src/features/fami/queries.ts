import "server-only";

import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { brtYearUtcBounds } from "@/features/fami/fami-year";

export type {
  FamiEvolutionPoint,
  FamiEvolutionYearPoint,
  FamiSectionSnapshot,
  FamiSnapshot,
} from "./read-types";

const famiContextRowSchema = z.object({
  cycle_processings: z.object({
    cycle_id: z.string().min(1),
    processing_version: z.number().int().positive(),
    status: z.literal("completed"),
    cycles: z.union([
      z.object({
        form_versions: z.union([
          z.object({ form_id: z.string().min(1) }),
          z.array(z.object({ form_id: z.string().min(1) })),
        ]),
      }),
      z.array(z.object({
        form_versions: z.union([
          z.object({ form_id: z.string().min(1) }),
          z.array(z.object({ form_id: z.string().min(1) })),
        ]),
      })),
    ]),
  }),
});

function mapFamiContext(value: unknown): { cycleId: string; formId: string; processingVersion: number } | null {
  const processing = famiContextRowSchema.parse(value).cycle_processings;
  const cycle = Array.isArray(processing.cycles) ? processing.cycles[0] : processing.cycles;
  const formVersions = cycle?.form_versions;
  const formVersion = Array.isArray(formVersions) ? formVersions[0] : formVersions;
  if (!cycle || !formVersion) return null;
  return {
    cycleId: processing.cycle_id,
    formId: formVersion.form_id,
    processingVersion: processing.processing_version,
  };
}

/**
 * Contexto do diagnóstico FAMI mais recente de uma organização.
 * O critério é o `created_at` do snapshot global; depois da seleção, todo o
 * restante do fluxo usa o cycleId retornado.
 */
export async function resolveLatestFamiContextForOrganization(
  organizationId: string,
): Promise<{ cycleId: string; formId: string; processingVersion: number } | null> {
  const client = createSupabaseServiceRoleClient();
  const { data, error } = await client
    .from("fami_results")
    .select(
      "created_at, cycle_processings!inner(cycle_id, processing_version, status, cycles!inner(organization_id, form_versions!inner(form_id)))",
    )
    .eq("scope_type", "global")
    .eq("cycle_processings.status", "completed")
    .eq("cycle_processings.cycles.organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return mapFamiContext(data);
}

/**
 * Snapshot global mais recente de uma organização dentro de um ano BRT.
 * Não infere ciclo por formulário/versão: a linha FAMI selecionada já carrega
 * o `cycle_id` físico do processamento.
 */
export async function resolveYearEndFamiContextForOrganization(
  organizationId: string,
  year: number,
): Promise<{ cycleId: string; formId: string; processingVersion: number } | null> {
  const { fromInclusive, toInclusive } = brtYearUtcBounds(year);
  const client = createSupabaseServiceRoleClient();
  const { data, error } = await client
    .from("fami_results")
    .select(
      "created_at, cycle_processings!inner(cycle_id, processing_version, status, cycles!inner(organization_id, form_versions!inner(form_id)))",
    )
    .eq("scope_type", "global")
    .eq("cycle_processings.status", "completed")
    .eq("cycle_processings.cycles.organization_id", organizationId)
    .gte("created_at", fromInclusive)
    .lte("created_at", toInclusive)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return mapFamiContext(data);
}
