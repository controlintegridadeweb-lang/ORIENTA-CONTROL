/**
 * Caminho canônico do bucket privado `evidencias`.
 *
 * Estrutura:
 *   {organizationId}/{cycleId}/{objectId}-{filename}
 *
 * O segundo segmento é sempre o ciclo. Isso permite que as policies de
 * `storage.objects` verifiquem o estado do ciclo antes de qualquer mutação.
 */
export function evidenceStoragePrefix(
  organizationId: string,
  cycleId: string,
): string {
  return `${organizationId}/${cycleId}/`;
}

export function buildEvidenceStoragePath(
  organizationId: string,
  cycleId: string,
  objectId: string,
  safeFilename: string,
): string {
  return `${evidenceStoragePrefix(organizationId, cycleId)}${objectId}-${safeFilename}`;
}

/** Confirma que o objeto pertence exatamente ao ciclo informado. */
export function isEvidenceStoragePathForCycle(
  path: string | null | undefined,
  input: { organizationId: string; cycleId: string },
): boolean {
  return Boolean(
    path?.startsWith(evidenceStoragePrefix(input.organizationId, input.cycleId)),
  );
}
