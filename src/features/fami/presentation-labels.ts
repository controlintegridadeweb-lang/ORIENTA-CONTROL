/** Rótulos canônicos para não confundir política FAMI com processamento. */
export function formatProcessingLabel(processingVersion: number | null | undefined): string {
  return processingVersion == null ? "Processamento não identificado" : `Processamento nº ${processingVersion}`;
}

export function formatFamiPolicyLabel(policyVersion: string | null | undefined): string {
  return policyVersion ? `Política FAMI ${policyVersion}` : "Política FAMI não identificada";
}

export function processingFileToken(processingVersion: number): string {
  return `processamento-${processingVersion}`;
}
