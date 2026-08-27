import { describe, expect, it } from "vitest";
import {
  bimesterClosesQuadrimester,
  bimesterPeriod,
  bimestersOfQuadrimester,
  BIMESTERS,
  hasBimesterStarted,
  isBimesterClosed,
  quadrimesterClosedByBimester,
  quadrimesterContainingBimester,
  quadrimesterPeriod,
} from "./calendar-periods";

describe("períodos civis do acompanhamento", () => {
  it("janeiro/fevereiro = 1º bimestre", () => {
    expect(bimesterPeriod(2026, 1)).toMatchObject({
      start: "2026-01-01",
      end: "2026-02-28",
      label: "1º bimestre",
      shortLabel: "Jan–Fev",
      closesQuadrimester: false,
      quadrimester: null,
    });
  });

  it("usa o último dia de fevereiro em ano bissexto", () => {
    expect(bimesterPeriod(2028, 1).end).toBe("2028-02-29");
  });

  it("março/abril = 2º bimestre e fechamento do 1º quadrimestre", () => {
    expect(bimesterPeriod(2026, 2)).toMatchObject({
      start: "2026-03-01",
      end: "2026-04-30",
      closesQuadrimester: true,
      quadrimester: 1,
    });
    expect(quadrimesterClosedByBimester(2)).toBe(1);
    expect(quadrimesterPeriod(2026, 1).end).toBe("2026-04-30");
  });

  it("maio/junho = 3º bimestre", () => {
    expect(bimesterPeriod(2026, 3)).toMatchObject({
      start: "2026-05-01",
      end: "2026-06-30",
      closesQuadrimester: false,
    });
  });

  it("julho/agosto = 4º bimestre e fechamento do 2º quadrimestre", () => {
    expect(bimesterPeriod(2026, 4)).toMatchObject({
      start: "2026-07-01",
      end: "2026-08-31",
      closesQuadrimester: true,
      quadrimester: 2,
    });
    expect(bimesterClosesQuadrimester(4)).toBe(true);
  });

  it("setembro/outubro = 5º bimestre", () => {
    expect(bimesterPeriod(2026, 5)).toMatchObject({
      start: "2026-09-01",
      end: "2026-10-31",
      closesQuadrimester: false,
    });
  });

  it("novembro/dezembro = 6º bimestre e fechamento do 3º quadrimestre", () => {
    expect(bimesterPeriod(2026, 6)).toMatchObject({
      start: "2026-11-01",
      end: "2026-12-31",
      closesQuadrimester: true,
      quadrimester: 3,
    });
    expect(bimestersOfQuadrimester(3)).toEqual([5, 6]);
  });

  it("cobre o ano sem sobreposição entre bimestres", () => {
    const periods = BIMESTERS.map((bimester) => bimesterPeriod(2026, bimester));
    expect(periods[0]?.start).toBe("2026-01-01");
    expect(periods[5]?.end).toBe("2026-12-31");
    for (let index = 1; index < periods.length; index += 1) {
      expect(periods[index]?.start > (periods[index - 1]?.end ?? "")).toBe(true);
    }
  });

  it("só libera o bimestre depois da data de corte em Fortaleza", () => {
    expect(isBimesterClosed(2026, 2, new Date("2026-04-30T23:59:59.999-03:00"))).toBe(false);
    expect(isBimesterClosed(2026, 2, new Date("2026-05-01T00:00:00.000-03:00"))).toBe(true);
    expect(hasBimesterStarted(2026, 3, new Date("2026-05-01T00:00:00.000-03:00"))).toBe(true);
    expect(hasBimesterStarted(2026, 3, new Date("2026-04-30T23:59:59.999-03:00"))).toBe(false);
  });

  it("associa cada bimestre ao quadrimestre correspondente", () => {
    expect(quadrimesterContainingBimester(1)).toBe(1);
    expect(quadrimesterContainingBimester(2)).toBe(1);
    expect(quadrimesterContainingBimester(3)).toBe(2);
    expect(quadrimesterContainingBimester(4)).toBe(2);
    expect(quadrimesterContainingBimester(5)).toBe(3);
    expect(quadrimesterContainingBimester(6)).toBe(3);
  });
});
