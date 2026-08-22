import { cache } from "react";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import type { EvidenceStatusBreakdown } from "./types";

export type EvidenceMetrics = {
  pendingCount: number;
  breakdown: EvidenceStatusBreakdown;
};

/** Deriva a fila de validação e o breakdown a partir de contagens agregadas. */
export function evidenceMetricsFromCounts(input: {
  aguardando_envio: number;
  aguardando_validacao: number;
  ajuste_solicitado: number;
  aprovadas: number;
  nao_aprovadas: number;
}): EvidenceMetrics {
  const breakdown: EvidenceStatusBreakdown = {
    pending: input.aguardando_envio,
    submitted: input.aguardando_validacao,
    adjustment_requested: input.ajuste_solicitado,
    approved: input.aprovadas,
    invalidated: input.nao_aprovadas,
  };
  return {
    pendingCount: input.aguardando_validacao,
    breakdown,
  };
}

async function computeEvidenceMetricsUncached(
  organizationId?: string,
): Promise<EvidenceMetrics> {
  const client = createSupabaseServiceRoleClient();
  const { data, error } = await client.rpc("get_evidence_metrics", {
    p_organization_id: organizationId,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) {
    throw new Error("get_evidence_metrics: resposta sem linha agregada.");
  }
  return evidenceMetricsFromCounts({
    aguardando_envio: Number(row.aguardando_envio),
    aguardando_validacao: Number(row.aguardando_validacao),
    ajuste_solicitado: Number(row.ajuste_solicitado),
    aprovadas: Number(row.aprovadas),
    nao_aprovadas: Number(row.nao_aprovadas),
  });
}

export const getCachedEvidenceMetricsGlobal = cache(() =>
  computeEvidenceMetricsUncached(),
);

export const getCachedEvidenceMetricsForOrganization = cache(
  (organizationId: string) => computeEvidenceMetricsUncached(organizationId),
);
