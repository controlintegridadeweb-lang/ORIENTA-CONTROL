import { describe, expect, it } from "vitest";
import { famiAnnualLabels } from "@/shared/labels/official-labels";
import { resolveAnnualFamiDisplay } from "./annual-result";

const BEFORE_YEAR_END = new Date("2026-08-13T14:00:00.000-03:00");
const AFTER_YEAR_END = new Date("2027-01-01T00:00:00.000-03:00");

describe("resolveAnnualFamiDisplay", () => {
  it("não publica o FAMI anual antes do fechamento do ano", () => {
    const display = resolveAnnualFamiDisplay({
      referenceYear: 2026,
      percentage: 49.5,
      maturityLevel: 3,
      now: BEFORE_YEAR_END,
    });
    expect(display.published).toBe(false);
    expect(display.percentage).toBeNull();
    expect(display.label).toBe(famiAnnualLabels.pending);
  });

  it("publica o percentual oficial só depois de 31/12", () => {
    const display = resolveAnnualFamiDisplay({
      referenceYear: 2026,
      percentage: 49.5,
      maturityLevel: 3,
      now: AFTER_YEAR_END,
    });
    expect(display.published).toBe(true);
    expect(display.percentage).toBe(49.5);
    expect(display.maturityLevel).toBe(3);
  });

  it("permanece não calculado após o ano se o diagnóstico ainda não tem resultado", () => {
    const display = resolveAnnualFamiDisplay({
      referenceYear: 2026,
      percentage: null,
      maturityLevel: null,
      now: AFTER_YEAR_END,
    });
    expect(display.published).toBe(false);
    expect(display.label).toBe(famiAnnualLabels.pending);
  });
});
