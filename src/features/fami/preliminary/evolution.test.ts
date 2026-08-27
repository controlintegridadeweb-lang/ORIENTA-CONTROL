import { describe, expect, it } from "vitest";
import { buildQuadrimesterEvolution, criterionEvolutionLabel } from "./evolution";

describe("evolução quadrimestral do FAMI preliminar", () => {
  it("marca critérios que passaram a pontuar e soma a recuperação do período", () => {
    const evolution = buildQuadrimesterEvolution({
      officialPercentage: 40,
      previousPreliminaryPercentage: 40,
      currentPreliminaryPercentage: 70,
      previous: [
        {
          questionVersionId: "q1",
          questionPrompt: "Critério 1",
          criterionCompleted: false,
          activeActionCount: 1,
          recoveredPoints: 0,
          preliminaryPoints: 0,
          officialPoints: 0,
        },
      ],
      current: [
        {
          questionVersionId: "q1",
          questionPrompt: "Critério 1",
          criterionCompleted: true,
          activeActionCount: 1,
          recoveredPoints: 2,
          preliminaryPoints: 2,
          officialPoints: 0,
        },
      ],
    });
    expect(evolution.criteriaNowScoring).toBe(1);
    expect(evolution.recoveredPoints).toBe(2);
    expect(evolution.deltaPercentagePoints).toBe(30);
    expect(evolution.rows).toEqual([
      {
        questionVersionId: "q1",
        questionPrompt: "Critério 1",
        previousStatus: "em_andamento",
        currentStatus: "concluido",
        recoveredPoints: 2,
      },
    ]);
  });

  it("compara com o FAMI oficial quando não há preliminar anterior", () => {
    const evolution = buildQuadrimesterEvolution({
      officialPercentage: 50,
      previousPreliminaryPercentage: null,
      currentPreliminaryPercentage: 62.5,
      previous: [],
      current: [
        {
          questionVersionId: "q2",
          criterionCompleted: true,
          activeActionCount: 1,
          recoveredPoints: 1,
          preliminaryPoints: 1,
          officialPoints: 0,
        },
      ],
    });
    expect(evolution.deltaPercentagePoints).toBe(12.5);
    expect(evolution.previousPreliminaryPercentage).toBeNull();
    expect(criterionEvolutionLabel("nao_iniciado")).toBe("Não iniciado");
  });
});
