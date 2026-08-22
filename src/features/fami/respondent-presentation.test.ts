import { describe, expect, it } from "vitest";
import type { FamiEvolutionPoint, FamiSnapshot } from "@/features/fami/queries";
import {
  evolutionDelta,
  interpretSnapshot,
  levelFromPercentage,
  levelGoal,
  rankAxesByPriority,
} from "./respondent-presentation";

describe("levelFromPercentage", () => {
  it("mapeia os 5 niveis pelos limiares", () => {
    expect(levelFromPercentage(0)).toBe(1);
    expect(levelFromPercentage(20)).toBe(1);
    expect(levelFromPercentage(20.01)).toBe(2);
    expect(levelFromPercentage(40)).toBe(2);
    expect(levelFromPercentage(40.01)).toBe(3);
    expect(levelFromPercentage(60)).toBe(3);
    expect(levelFromPercentage(60.01)).toBe(4);
    expect(levelFromPercentage(80)).toBe(4);
    expect(levelFromPercentage(80.01)).toBe(5);
    expect(levelFromPercentage(100)).toBe(5);
  });
});

describe("levelGoal", () => {
  it("usa exatamente a próxima fronteira de 0,01 ponto percentual", () => {
    const g = levelGoal(60);
    expect(g.current).toBe(3);
    expect(g.next).toBe(4);
    expect(g.threshold).toBe(60.01);
    expect(g.gap).toBe(0.01);
  });
  it("nivel 5 nao tem proximo", () => {
    const g = levelGoal(95);
    expect(g.current).toBe(5);
    expect(g.next).toBeNull();
  });
});

describe("rankAxesByPriority", () => {
  it("ordena pelo impacto descendente e marca criticos/avancados", () => {
    const ranked = rankAxesByPriority([
      { axisName: "A", percentage: 30, maturityLevel: 2 },
      { axisName: "B", percentage: 80, maturityLevel: 4 },
      { axisName: "C", percentage: 10, maturityLevel: 1 },
    ]);
    expect(ranked[0]!.axisName).toBe("C");
    expect(ranked[ranked.length - 1]!.axisName).toBe("B");
    expect(ranked.find((r) => r.axisName === "B")!.isAdvanced).toBe(true);
    expect(ranked.find((r) => r.axisName === "A")!.isCritical).toBe(true);
  });

  it("exclui eixos N/A de rankings, criticidade e prioridades", () => {
    const ranked = rankAxesByPriority([
      { axisName: "Aplicável", percentage: 60, maturityLevel: 3 },
      { axisName: "Não aplicável", percentage: 0, maturityLevel: null },
    ]);

    expect(ranked.map((axis) => axis.axisName)).toEqual(["Aplicável"]);
  });
});

describe("evolutionDelta", () => {
  function makePoint(over: Partial<FamiEvolutionPoint> = {}): FamiEvolutionPoint {
    return {
      processingVersion: 1,
      policyVersion: "v3",
      createdAt: "2025-01-01",
      globalPercentage: 50,
      globalMaturityLevel: 2,
      axisPercentages: {},
      ...over,
    };
  }

  it("vazio retorna unknown", () => {
    const d = evolutionDelta([]);
    expect(d.delta).toBeNull();
    expect(d.trend).toBe("unknown");
  });
  it("crescimento marca trend up", () => {
    const d = evolutionDelta([
      makePoint({ processingVersion: 1, globalPercentage: 40 }),
      makePoint({ processingVersion: 2, globalPercentage: 55 }),
    ]);
    expect(d.delta).toBe(15);
    expect(d.trend).toBe("up");
  });
  it("queda marca trend down", () => {
    const d = evolutionDelta([
      makePoint({ processingVersion: 1, globalPercentage: 70 }),
      makePoint({ processingVersion: 2, globalPercentage: 60 }),
    ]);
    expect(d.trend).toBe("down");
  });

  it("não converte períodos N/A em zero nem calcula variação artificial", () => {
    const d = evolutionDelta([
      makePoint({ processingVersion: 1, globalPercentage: 70 }),
      makePoint({ processingVersion: 2, globalPercentage: null, globalMaturityLevel: null }),
    ]);
    expect(d.currentPercentage).toBeNull();
    expect(d.delta).toBeNull();
    expect(d.trend).toBe("unknown");
    expect(d.sparkline).toEqual([70]);
  });
});


describe("interpretSnapshot", () => {
  function makeSnapshot(over: Partial<FamiSnapshot> = {}): FamiSnapshot {
    return {
      formId: "form-1",
      organizationId: "org-1",
      processingVersion: 1,
      policyVersion: "v3",
      global: {
        percentage: 60,
        maturityLevel: 3,
        pointsObtained: 60,
        pointsPossible: 100,
        createdAt: "2025-01-01",
      },
      axes: [
        { axisName: "Governança", percentage: 80, maturityLevel: 4 },
        { axisName: "Pessoas", percentage: 40, maturityLevel: 2 },
      ],
      sections: [],
      ...over,
    };
  }

  it("gera summary e cartoes quando ha snapshot", () => {
    const r = interpretSnapshot(makeSnapshot());
    // Summary não ecoa o score do banner — só a meta de evolução.
    expect(r.summary).not.toMatch(/Sua maturidade atual|maturidade atual é de/i);
    expect(r.summary.toLowerCase()).toMatch(/nível|próximo diagnóstico|mantenha/);
    expect(r.cards.length).toBeGreaterThan(0);
    expect(r.topAxis?.axisName).toBe("Governança");
    expect(r.bottomAxis?.axisName).toBe("Pessoas");
  });

  it("não duplica ponto crítico e prioridade no mesmo eixo", () => {
    const r = interpretSnapshot(makeSnapshot());
    const titles = r.cards.map((card) => card.title);
    expect(titles.filter((title) => title === "Pessoas")).toHaveLength(1);
    expect(r.cards.some((card) => card.kind === "opportunity" && card.axisName === "Pessoas")).toBe(
      true,
    );
    expect(titles.some((title) => title.startsWith("Ponto crítico"))).toBe(false);
  });

  it("summary não repete maior/menor eixo (ficam nos cards)", () => {
    const r = interpretSnapshot(makeSnapshot());
    expect(r.summary).not.toMatch(/Maior desempenho|Menor desempenho/);
  });
  it("snapshot vazio devolve summary neutro", () => {
    const r = interpretSnapshot(null);
    expect(r.cards).toHaveLength(0);
    expect(r.topAxis).toBeNull();
  });

  it("resultado global N/A não gera pior eixo, prioridade ou criticidade", () => {
    const r = interpretSnapshot(
      makeSnapshot({
        global: {
          percentage: 0,
          maturityLevel: null,
          pointsObtained: 0,
          pointsPossible: 0,
          createdAt: "2025-01-01",
        },
        axes: [{ axisName: "Governança", percentage: 0, maturityLevel: null }],
      }),
    );

    expect(r.summary).toContain("N/A");
    expect(r.topAxis).toBeNull();
    expect(r.bottomAxis).toBeNull();
    expect(r.criticalAxes).toEqual([]);
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0]?.kind).toBe("neutral");
  });
});
