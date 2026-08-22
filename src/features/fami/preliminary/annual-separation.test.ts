import { describe, expect, it } from "vitest";
import { famiAnnualLabels, famiPreliminaryLabels } from "@/shared/labels/official-labels";
import { resolveQuadrimesterDisplay } from "./panel-presentation";

describe("separação entre FAMI anual e FAMI preliminar quadrimestral", () => {
  it("mantém nomes e papéis distintos nos rótulos", () => {
    expect(famiAnnualLabels.title).toBe("FAMI anual");
    expect(famiPreliminaryLabels.title).toBe("Acompanhamento quadrimestral");
    expect(famiAnnualLabels.disclaimer).toMatch(/não o substitui/);
    expect(famiPreliminaryLabels.description).toMatch(/não substitui o FAMI anual/);
    expect(famiPreliminaryLabels.panoramaLabel).toBe("FAMI preliminar");
    expect(famiAnnualLabels.pending).toBe("Não calculado");
    expect(famiAnnualLabels.pendingHint).toMatch(/fechamento anual/);
  });

  it("não usa o resultado anual para preencher a coluna preliminar", () => {
    const display = resolveQuadrimesterDisplay({
      started: true,
      closed: false,
      officialAvailable: true,
      hasImplementation: true,
      checkpoint: null,
    });
    expect(display.percentage).toBeNull();
    expect(display.action).toBe("calculate");
  });
});
