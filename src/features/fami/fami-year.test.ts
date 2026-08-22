import { describe, expect, it } from "vitest";
import { brtYearUtcBounds, FAMI_CALENDAR_TIMEZONE, getCalendarYearBrt, isCalendarYearClosed } from "./fami-year";

describe("getCalendarYearBrt", () => {
  it("classifica 31 de dezembro 23h BRT como o ano corrente", () => {
    expect(getCalendarYearBrt("2025-12-31T23:30:00.000Z")).toBe(2025);
  });

  it("classifica inicio de janeiro seguinte em UTC como BRT ainda dezembro quando aplicavel", () => {
    expect(getCalendarYearBrt("2026-01-01T02:30:00.000Z")).toBe(2025);
  });

  it("usa fuso BRT para primeiro instante civil do ano", () => {
    expect(getCalendarYearBrt("2026-01-01T03:00:00.000Z")).toBe(2026);
  });

  it("timezone constante esperado", () => {
    expect(FAMI_CALENDAR_TIMEZONE).toBe("America/Sao_Paulo");
  });
});

describe("isCalendarYearClosed", () => {
  it("mantém 2026 aberto em 13 de agosto", () => {
    expect(isCalendarYearClosed(2026, new Date("2026-08-13T14:00:00.000-03:00"))).toBe(false);
    expect(isCalendarYearClosed(2026, new Date("2026-12-31T23:59:59.999-03:00"))).toBe(false);
  });

  it("fecha 2026 no primeiro instante de 2027 em Fortaleza", () => {
    expect(isCalendarYearClosed(2026, new Date("2027-01-01T00:00:00.000-03:00"))).toBe(true);
  });
});

describe("brtYearUtcBounds", () => {
  it("embrulha ano completo BRT em UTC", () => {
    const { fromInclusive, toInclusive } = brtYearUtcBounds(2026);
    expect(fromInclusive).toBe("2026-01-01T03:00:00.000Z");
    expect(toInclusive).toBe("2027-01-01T02:59:59.999Z");
  });

  it("rejeita ano invalido", () => {
    expect(() => brtYearUtcBounds(1800)).toThrow(RangeError);
  });
});
