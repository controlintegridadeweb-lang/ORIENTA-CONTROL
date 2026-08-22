import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  businessDateBoundaryIso,
  businessToday,
  formatLocalDate,
  isLocalDate,
} from "./business-date";

describe("business-date", () => {
  it("mantém datas de calendário sem deslocamento de fuso", () => {
    expect(formatLocalDate("2026-07-11")).toContain("11");
  });

  it("usa o dia institucional de Fortaleza na virada UTC", () => {
    expect(businessToday(new Date("2026-07-12T00:30:00.000Z"))).toBe("2026-07-11");
  });

  it("faz aritmética de calendário em viradas de mês e ano", () => {
    expect(addCalendarDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("rejeita datas impossíveis", () => {
    expect(isLocalDate("2026-02-29")).toBe(false);
    expect(isLocalDate("2028-02-29")).toBe(true);
  });


  it("converte limites do dia institucional para UTC sem usar o fuso do navegador", () => {
    expect(businessDateBoundaryIso("2026-07-12", "start")).toBe(
      "2026-07-12T03:00:00.000Z",
    );
    expect(businessDateBoundaryIso("2026-07-12", "end")).toBe(
      "2026-07-13T02:59:59.999Z",
    );
  });
});
