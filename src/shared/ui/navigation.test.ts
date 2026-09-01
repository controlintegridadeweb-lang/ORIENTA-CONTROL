import { describe, expect, it } from "vitest";
import {
  RESPONDENT_ACTION_PLAN_MODULE_LABEL,
  RESPONDENT_RECOMMENDATIONS_PORTFOLIO_LABEL,
} from "@/shared/navigation/respondent-portfolio-paths";
import { navigationByRole } from "./navigation";

function analysisLabels(role: keyof typeof navigationByRole) {
  return navigationByRole[role]
    .filter((item) => item.group === (role === "admin" ? "analise" : "principal"))
    .map((item) => item.label);
}

describe("navigationByRole", () => {
  it("mantém FAMI antes de recomendações e plano no perfil administrador", () => {
    const labels = analysisLabels("admin");
    expect(labels.indexOf("Resultado FAMI")).toBeLessThan(labels.indexOf("Recomendações"));
    expect(labels.indexOf("Recomendações")).toBeLessThan(labels.indexOf("Plano de integridade e compliance"));
  });

  it("mantém FAMI antes de recomendações e plano no perfil respondente", () => {
    const labels = analysisLabels("respondent");
    expect(labels.indexOf("Resultado FAMI")).toBeLessThan(
      labels.indexOf(RESPONDENT_RECOMMENDATIONS_PORTFOLIO_LABEL),
    );
    expect(labels.indexOf(RESPONDENT_RECOMMENDATIONS_PORTFOLIO_LABEL)).toBeLessThan(
      labels.indexOf(RESPONDENT_ACTION_PLAN_MODULE_LABEL),
    );
    expect(labels).toContain(RESPONDENT_RECOMMENDATIONS_PORTFOLIO_LABEL);
    expect(labels).toContain(RESPONDENT_ACTION_PLAN_MODULE_LABEL);
  });

  it("inclui Suporte no grupo Sistema para os dois perfis", () => {
    for (const role of ["admin", "respondent"] as const) {
      const items = navigationByRole[role];
      const support = items.find((item) => item.label === "Suporte");
      const profile = items.find((item) => item.label === "Meu Perfil");
      expect(support?.group).toBe("sistema");
      expect(profile?.group).toBe("sistema");
      expect(support?.href).toMatch(/\/suporte$/);
      expect(items.indexOf(profile!)).toBeLessThan(items.indexOf(support!));
    }
  });
});
