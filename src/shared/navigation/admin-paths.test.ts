import { describe, expect, it } from "vitest";
import {
  adminSectionActionWorkspaceHref,
  adminSectionPlanEntryHref,
} from "./admin-paths";

const SECTION_ID = "22222222-2222-4222-8222-222222222222";
const CYCLE_ID = "33333333-3333-4333-8333-333333333333";
const FIRST_RECOMMENDATION_ID = "11111111-1111-4111-8111-111111111111";

describe("adminSectionActionWorkspaceHref", () => {
  it("abre o workspace pela seção e pelo ciclo", () => {
    const href = adminSectionActionWorkspaceHref(SECTION_ID, CYCLE_ID, "visao-geral");
    expect(href).toBe(
      `/admin/plano-acao/secao/${SECTION_ID}/visao-geral?cycleId=${CYCLE_ID}`,
    );
    expect(href).not.toContain(FIRST_RECOMMENDATION_ID);
  });

  it("rejeita identificadores inválidos", () => {
    expect(() => adminSectionActionWorkspaceHref("invalida", CYCLE_ID)).toThrow("sectionId/cycleId");
  });
});

describe("adminSectionPlanEntryHref", () => {
  it("não usa a primeira recomendação como substituto da seção", () => {
    const href = adminSectionPlanEntryHref(SECTION_ID, CYCLE_ID, "/admin/plano-acao");
    expect(href).toContain(`/secao/${SECTION_ID}/visao-geral`);
    expect(href).not.toContain(FIRST_RECOMMENDATION_ID);
  });

  it("volta ao fallback quando os identificadores são inválidos", () => {
    expect(adminSectionPlanEntryHref("invalida", CYCLE_ID, "/admin/plano-acao")).toBe("/admin/plano-acao");
  });
});
