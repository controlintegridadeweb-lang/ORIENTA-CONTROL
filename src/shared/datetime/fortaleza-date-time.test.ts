import { describe, expect, it } from "vitest";
import {
  asFortalezaIso,
  parseFortalezaDateTime,
  toFortalezaDateTimeInput,
} from "./fortaleza-date-time";

describe("fortaleza-date-time", () => {
  it("formata um instante no fuso de Fortaleza", () => {
    expect(toFortalezaDateTimeInput(new Date("2026-07-17T23:30:00.000Z"))).toBe(
      "2026-07-17T20:30",
    );
  });

  it("interpreta datetime-local como UTC−3", () => {
    expect(parseFortalezaDateTime("2026-07-17T20:30")?.toISOString()).toBe(
      "2026-07-17T23:30:00.000Z",
    );
    expect(asFortalezaIso("2026-07-17T20:30")).toBe("2026-07-17T23:30:00.000Z");
  });

  it("rejeita valores incompletos", () => {
    expect(parseFortalezaDateTime("17/07/2026 20:30")).toBeNull();
    expect(asFortalezaIso("")).toBeNull();
  });
});
