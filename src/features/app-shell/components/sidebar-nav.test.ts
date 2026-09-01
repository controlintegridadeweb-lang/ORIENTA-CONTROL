import { describe, expect, it } from "vitest";
import { isSidebarNavActive } from "./sidebar-nav";

const RECOMMENDATIONS = "/respondente/portfolio-recomendacoes";
const ACTION_PLAN = "/respondente/plano-acao";

describe("isSidebarNavActive", () => {
  it("marca Recomendações apenas na lista de análise", () => {
    expect(isSidebarNavActive(RECOMMENDATIONS, RECOMMENDATIONS)).toBe(true);
    expect(isSidebarNavActive(RECOMMENDATIONS, RECOMMENDATIONS, "status=generated")).toBe(true);
    expect(isSidebarNavActive(RECOMMENDATIONS, RECOMMENDATIONS, "view=action-plan")).toBe(false);
    expect(
      isSidebarNavActive(
        "/respondente/plano-acao/11111111-1111-4111-8111-111111111111/acoes",
        RECOMMENDATIONS,
      ),
    ).toBe(false);
  });

  it("marca Plano de integridade e compliance na lista e nos workspaces operacionais", () => {
    expect(isSidebarNavActive(RECOMMENDATIONS, ACTION_PLAN, "view=action-plan")).toBe(true);
    expect(
      isSidebarNavActive(
        "/respondente/plano-acao/11111111-1111-4111-8111-111111111111/acoes",
        ACTION_PLAN,
      ),
    ).toBe(true);
    expect(
      isSidebarNavActive(
        "/respondente/plano-acao/secao/22222222-2222-4222-8222-222222222222/visao-geral",
        ACTION_PLAN,
      ),
    ).toBe(true);
    expect(isSidebarNavActive(RECOMMENDATIONS, ACTION_PLAN)).toBe(false);
  });

  it("não pinta o Dashboard em sub-rotas do mesmo perfil", () => {
    expect(isSidebarNavActive("/admin/recomendacoes", "/admin")).toBe(false);
    expect(isSidebarNavActive("/respondente/formularios", "/respondente")).toBe(false);
  });
});
