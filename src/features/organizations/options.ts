import "server-only";

import { listAllOrganizationOptions } from "@/features/organizations/admin-service";

export type OrganizationOption = { id: string; name: string };

/**
 * Lista organizações para seletores administrativos usando paginação
 * controlada no banco, sem depender do limite implícito do PostgREST.
 */
export async function getOrganizationOptions(): Promise<OrganizationOption[]> {
  const organizations = await listAllOrganizationOptions();
  return organizations.map(({ id, name }) => ({ id, name }));
}
