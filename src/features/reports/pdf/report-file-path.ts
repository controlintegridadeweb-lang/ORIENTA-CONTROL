/**
 * Caminho imutável de cada emissão oficial no bucket privado `relatorios`.
 *
 * Estrutura:
 *   {organization_id}/{cycle_id}/{cycle_processing_id}/{emission_id}.pdf
 *
 * `emission_id` é gerado no servidor para que reemissões nunca substituam o
 * arquivo de uma versão anterior.
 */
export function officialReportStoragePath(
  organizationId: string,
  cycleId: string,
  cycleProcessingId: string,
  emissionId: string,
): string {
  return `${organizationId}/${cycleId}/${cycleProcessingId}/${emissionId}.pdf`;
}

/** Bucket privado de relatórios. */
export const REPORTS_BUCKET = "relatorios" as const;
