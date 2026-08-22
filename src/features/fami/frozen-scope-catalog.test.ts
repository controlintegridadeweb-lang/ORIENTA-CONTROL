import { describe, expect, it, vi } from "vitest";
import {
  buildFamiScopeIntegrityWarnings,
  loadFrozenFamiScopeCatalog,
  mapFrozenAxisMaturityRows,
  type FrozenFamiScopeCatalog,
} from "./frozen-scope-catalog";

const catalog: FrozenFamiScopeCatalog = {
  axes: new Map([
    ["axis-g", { id: "axis-g", name: "Governança histórica" }],
    ["axis-s", { id: "axis-s", name: "Social histórica" }],
  ]),
  sections: new Map([
    ["section-1", { id: "section-1", name: "Integridade histórica", order: 1, axisId: "axis-g" }],
    ["section-2", { id: "section-2", name: "Pessoas histórica", order: 2, axisId: "axis-s" }],
  ]),
};

describe("loadFrozenFamiScopeCatalog", () => {
  it("lê nomes imutáveis de question_versions, sem consultar tabelas vivas", async () => {
    const cycleBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { form_version_id: "form-version-1" },
        error: null,
      }),
    };
    const formQuestionsBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{
          question_versions: {
            section_id: "section-1",
            section_name: "Nome congelado",
            section_order: 3,
            axis_id: "axis-g",
            axis_name: "Eixo congelado",
          },
        }],
        error: null,
      }),
    };
    const from = vi.fn((table: string) => {
      if (table === "cycles") return cycleBuilder;
      if (table === "form_questions") return formQuestionsBuilder;
      throw new Error(`Tabela viva consultada indevidamente: ${table}`);
    });

    const result = await loadFrozenFamiScopeCatalog({ from } as never, "cycle-1");

    expect(result.sections.get("section-1")?.name).toBe("Nome congelado");
    expect(result.axes.get("axis-g")?.name).toBe("Eixo congelado");
    expect(from).toHaveBeenCalledTimes(2);
  });
});

describe("mapFrozenAxisMaturityRows", () => {
  it("mapeia apenas eixos persistidos e não fabrica resultado 0% para eixo ausente", () => {
    const result = mapFrozenAxisMaturityRows([
      { scopeId: "axis-g", percentage: 75, maturityLevel: 4 },
    ], catalog);

    expect(result).toEqual([{
      axisId: "axis-g",
      axisName: "Governança histórica",
      percentage: 75,
      maturityLevel: 4,
    }]);
    expect(result.some((axis) => axis.axisId === "axis-s")).toBe(false);
  });
});

describe("buildFamiScopeIntegrityWarnings", () => {
  it("não cria alerta quando os escopos armazenados coincidem com a versão publicada", () => {
    expect(buildFamiScopeIntegrityWarnings(
      catalog,
      ["axis-g", "axis-s"],
      ["section-1", "section-2"],
    )).toEqual([]);
  });

  it("expõe ausências e escopos inesperados", () => {
    const warnings = buildFamiScopeIntegrityWarnings(
      catalog,
      ["axis-g", "axis-extra"],
      ["section-1"],
    );

    expect(warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("Social histórica"),
      expect.stringContaining("axis-extra"),
      expect.stringContaining("Pessoas histórica"),
    ]));
  });
});
