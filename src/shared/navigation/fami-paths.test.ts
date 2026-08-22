import { describe, expect, it } from "vitest";
import { adminFamiPath, respondentFamiPath } from "./fami-paths";

describe("FAMI navigation paths", () => {
  it("serializa o recorte do respondente", () => {
    expect(respondentFamiPath({ cycleId: "cycle-1", year: 2025, tab: "eixos" })).toBe(
      "/respondente/pontuacao-fami?cycleId=cycle-1&year=2025&tab=eixos",
    );
  });

  it("serializa organização, diagnóstico, ano e aba da administração", () => {
    expect(
      adminFamiPath({
        organizationId: "org-1",
        formId: "form-1",
        cycleId: "cycle-1",
        year: 2026,
        tab: "evolucao",
      }),
    ).toBe(
      "/admin/maturidade?organizationId=org-1&formId=form-1&cycleId=cycle-1&year=2026&tab=evolucao",
    );
  });
});
