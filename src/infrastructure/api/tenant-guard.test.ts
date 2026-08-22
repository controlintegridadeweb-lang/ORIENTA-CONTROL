import { describe, expect, it } from "vitest";
import { ensureOrganizationAccess } from "./tenant-guard";
import type { AuthContext } from "./auth";

/**
 * Garantia central de isolamento multi-tenant: um respondente (ou admin
 * vinculado a uma org) NUNCA acessa dados de outra organização, mesmo passando
 * `organizationId` arbitrário no corpo/query da requisição. `ensureOrganizationAccess`
 * é o ponto único que força isso antes de qualquer acesso via service role.
 */

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";

function ctx(role: "admin" | "respondent", organizationId: string | null): AuthContext {
  return { userId: "user-1", role, organizationId, mfaVerified: role === "admin" };
}

describe("ensureOrganizationAccess — isolamento entre organizações", () => {
  it("respondente acessa a PRÓPRIA organização", () => {
    expect(ensureOrganizationAccess(ctx("respondent", ORG_A), ORG_A)).toBeNull();
  });

  it("respondente NÃO acessa outra organização (mesmo informando o id no body)", async () => {
    const result = ensureOrganizationAccess(ctx("respondent", ORG_A), ORG_B);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("respondente sem organização é barrado", () => {
    const result = ensureOrganizationAccess(ctx("respondent", null), ORG_A);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("administrador global tem visão cross-org", () => {
    expect(ensureOrganizationAccess(ctx("admin", null), ORG_A)).toBeNull();
    expect(ensureOrganizationAccess(ctx("admin", null), ORG_B)).toBeNull();
  });
});
