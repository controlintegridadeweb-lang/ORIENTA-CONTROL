import { describe, expect, it } from "vitest";
import { isGlobalAdmin } from "./scope";

describe("isGlobalAdmin", () => {
  it("admin sem organização vinculada é global", () => {
    expect(isGlobalAdmin({ role: "admin", organizationId: null })).toBe(true);
  });

  it("trata entrada inválida como administrativa por papel, embora o schema não a persista", () => {
    // `0002_organizacoes_perfis_autorizacao.sql` impede esta persistência no banco. A
    // camada de autorização continua segura por papel caso receba entrada inválida.
    expect(isGlobalAdmin({ role: "admin", organizationId: "org-x" })).toBe(true);
  });

  it("respondente nunca é global", () => {
    expect(isGlobalAdmin({ role: "respondent", organizationId: "org-x" })).toBe(false);
  });
});


