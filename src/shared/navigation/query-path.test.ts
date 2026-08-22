import { describe, expect, it } from "vitest";
import { queryPath } from "./query-path";

describe("queryPath", () => {
  it("mantém apenas parâmetros preenchidos", () => {
    expect(
      queryPath("/admin/recomendacoes", {
        organizationId: " org-1 ",
        cycleId: "",
        formId: undefined,
      }),
    ).toBe("/admin/recomendacoes?organizationId=org-1");
  });

  it("retorna apenas o pathname quando não há filtros", () => {
    expect(queryPath("/admin/plano-acao", {})).toBe("/admin/plano-acao");
  });
});
