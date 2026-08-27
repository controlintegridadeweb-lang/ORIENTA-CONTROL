import { describe, expect, it } from "vitest";
import {
  aggregatePreliminaryCriteria,
  calculatePreliminaryCriterion,
  canAutomaticallyCloseBimester,
  canAutomaticallyCloseQuadrimester,
  canManuallyMaterializeBimester,
  canManuallyMaterializeQuadrimester,
  hasQuadrimesterStarted,
  isQuadrimesterClosed,
  officialFamiAvailableAtCutoff,
  officialFamiAvailableForQuadrimester,
  quadrimesterCutoffExclusive,
  quadrimesterPeriod,
} from "./domain";

describe("FAMI preliminar — prelim_v1", () => {
  it("parte do oficial e recupera o gap pela média das ações ativas", () => {
    expect(
      calculatePreliminaryCriterion({
        officialPoints: 0,
        pointsPossible: 2,
        activeActionProgressPercentages: [50, 100],
        hasApprovedException: false,
        hasRecommendation: true,
      }),
    ).toEqual({
      officialPoints: 0,
      pointsPossible: 2,
      recoverableGap: 2,
      activeActionCount: 2,
      actionProgressPercentage: 75,
      recoveredPoints: 1.5,
      preliminaryPoints: 1.5,
    });
  });

  it("recupera apenas o gap restante de políticas históricas", () => {
    const result = calculatePreliminaryCriterion({
      officialPoints: 1,
      pointsPossible: 2,
      activeActionProgressPercentages: [50],
      hasApprovedException: false,
      hasRecommendation: true,
    });
    expect(result.preliminaryPoints).toBe(1.5);
    expect(result.recoveredPoints).toBe(0.5);
  });

  it("não cria pontos sem recomendação", () => {
    const result = calculatePreliminaryCriterion({
      officialPoints: 0,
      pointsPossible: 2,
      activeActionProgressPercentages: [100],
      hasApprovedException: false,
      hasRecommendation: false,
    });
    expect(result.preliminaryPoints).toBe(0);
    expect(result.activeActionCount).toBe(0);
  });

  it("exceção aprovada não recupera pontos", () => {
    const result = calculatePreliminaryCriterion({
      officialPoints: 0,
      pointsPossible: 2,
      activeActionProgressPercentages: [100],
      hasApprovedException: true,
      hasRecommendation: true,
    });
    expect(result.preliminaryPoints).toBe(0);
    expect(result.actionProgressPercentage).toBe(0);
  });

  it("sem ação ativa mantém a pontuação oficial", () => {
    const result = calculatePreliminaryCriterion({
      officialPoints: 1,
      pointsPossible: 2,
      activeActionProgressPercentages: [],
      hasApprovedException: false,
      hasRecommendation: true,
    });
    expect(result.preliminaryPoints).toBe(1);
  });

  it("agrega pontos e nível sem misturar N/A", () => {
    expect(
      aggregatePreliminaryCriteria([
        { preliminaryPoints: 1, pointsPossible: 1 },
        { preliminaryPoints: 1, pointsPossible: 2 },
      ]),
    ).toEqual({
      pointsObtained: 2,
      pointsPossible: 3,
      percentage: 66.67,
      maturityLevel: 4,
    });
    expect(aggregatePreliminaryCriteria([])).toEqual({
      pointsObtained: 0,
      pointsPossible: 0,
      percentage: 0,
      maturityLevel: null,
    });
  });

  it("modela os três quadrimestres sem sobreposição", () => {
    expect(quadrimesterPeriod(2026, 1)).toEqual({
      start: "2026-01-01",
      end: "2026-04-30",
      label: "1º quadrimestre",
    });
    expect(quadrimesterPeriod(2026, 2).start).toBe("2026-05-01");
    expect(quadrimesterPeriod(2026, 3).end).toBe("2026-12-31");
  });

  it("só libera o quadrimestre depois da data de corte em Fortaleza", () => {
    expect(isQuadrimesterClosed(2026, 1, new Date("2026-04-30T23:59:59.999-03:00"))).toBe(false);
    expect(isQuadrimesterClosed(2026, 1, new Date("2026-05-01T00:00:00.000-03:00"))).toBe(true);
    expect(isQuadrimesterClosed(2026, 2, new Date("2026-08-12T22:00:00.000-03:00"))).toBe(false);
  });

  it("marca o 1º quadrimestre de 2026 sem FAMI quando o oficial só existiu depois do corte", () => {
    expect(hasQuadrimesterStarted(2026, 1, new Date("2026-08-13T10:00:00.000-03:00"))).toBe(true);
    expect(hasQuadrimesterStarted(2026, 3, new Date("2026-08-13T10:00:00.000-03:00"))).toBe(false);
    expect(officialFamiAvailableAtCutoff("2026-06-15T12:00:00.000Z", "2026-04-30")).toBe(false);
    expect(officialFamiAvailableAtCutoff("2026-06-15T12:00:00.000Z", "2026-08-31")).toBe(true);
    expect(
      officialFamiAvailableForQuadrimester({
        officialAvailableAt: "2026-06-15T12:00:00.000-03:00",
        referenceYear: 2026,
        quadrimester: 2,
        now: new Date("2026-08-13T10:00:00.000-03:00"),
      }),
    ).toBe(true);
    expect(
      officialFamiAvailableForQuadrimester({
        officialAvailableAt: "2026-06-15T12:00:00.000-03:00",
        referenceYear: 2026,
        quadrimester: 1,
        now: new Date("2026-08-13T10:00:00.000-03:00"),
      }),
    ).toBe(false);
  });

  it("usa o instante imediatamente após o corte como limite exclusivo", () => {
    expect(quadrimesterCutoffExclusive(2026, 1).toISOString()).toBe(
      new Date("2026-05-01T00:00:00.000-03:00").toISOString(),
    );
  });

  it("distingue gatilho manual e automático na mesma regra de elegibilidade", () => {
    expect(
      canManuallyMaterializeQuadrimester({
        started: true,
        closed: false,
        officialAvailable: true,
        hasClosedSnapshot: false,
      }),
    ).toBe(true);
    expect(
      canManuallyMaterializeQuadrimester({
        started: true,
        closed: false,
        officialAvailable: false,
        hasClosedSnapshot: false,
      }),
    ).toBe(false);
    expect(
      canAutomaticallyCloseQuadrimester({
        closed: true,
        officialAvailable: true,
        hasImplementation: false,
        hasCheckpoint: true,
        hasClosedSnapshot: false,
      }),
    ).toBe(true);
    expect(
      canAutomaticallyCloseQuadrimester({
        closed: true,
        officialAvailable: true,
        hasImplementation: false,
        hasCheckpoint: true,
        hasClosedSnapshot: true,
      }),
    ).toBe(false);
    expect(
      canAutomaticallyCloseBimester({
        closed: true,
        officialAvailable: true,
        hasImplementation: true,
        hasCheckpoint: false,
        hasClosedSnapshot: false,
      }),
    ).toBe(true);
    expect(
      canManuallyMaterializeBimester({
        started: true,
        closed: false,
        officialAvailable: true,
        hasClosedSnapshot: false,
      }),
    ).toBe(true);
  });
});
