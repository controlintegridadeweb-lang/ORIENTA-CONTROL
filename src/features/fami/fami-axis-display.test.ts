import { describe, expect, it } from "vitest";
import {
  AXIS_COLORS,
  AXIS_COLOR_FALLBACK,
  colorForAxisName,
  colorForAxisNameOrFallback,
  FAMI_AXIS_COLORS,
  sortAxesMaturity,
  structuralAxisOrderIndex,
} from "./fami-axis-display";
import type { AxisMaturity } from "./types";

function axis(name: string, percentage: number, maturityLevel: number): AxisMaturity {
  return { axisId: name, axisName: name, percentage, maturityLevel };
}

describe("colorForAxisName", () => {
  it("mapeia Governança/Ambiental/Social para azul/verde/rosa", () => {
    expect(colorForAxisName("Governanca")).toBe(FAMI_AXIS_COLORS.governance);
    expect(colorForAxisName("Governança")).toBe(FAMI_AXIS_COLORS.governance);
    expect(colorForAxisName("Ambiental")).toBe(FAMI_AXIS_COLORS.environmental);
    expect(colorForAxisName("Social")).toBe(FAMI_AXIS_COLORS.social);
    expect(FAMI_AXIS_COLORS.governance).toBe("#0097B2");
    expect(FAMI_AXIS_COLORS.environmental).toBe("#16A34A");
    expect(FAMI_AXIS_COLORS.social).toBe("#DB2777");
    expect(AXIS_COLORS.governance.text).toBe("#0097B2");
  });

  it("não inventa cor para eixo desconhecido", () => {
    expect(colorForAxisName("Inovação")).toBeUndefined();
  });

  it("usa fallback oficial para eixos não estruturais em gráficos", () => {
    expect(colorForAxisNameOrFallback("Governança")).toBe(AXIS_COLORS.governance.accent);
    expect(colorForAxisNameOrFallback("Inovação")).toBe(AXIS_COLOR_FALLBACK);
  });
});

describe("sortAxesMaturity", () => {
  it("ordena Governanca → Ambiental → Social (com ou sem acento)", () => {
    const sorted = sortAxesMaturity([
      axis("Social", 30, 2),
      axis("Ambiental", 40, 2),
      axis("Governança", 80, 4),
    ]);
    expect(sorted.map((a) => a.axisName)).toEqual([
      "Governança",
      "Ambiental",
      "Social",
    ]);
    expect(structuralAxisOrderIndex("Governança")).toBe(0);
    expect(structuralAxisOrderIndex("Governanca")).toBe(0);
  });

  it("eixos desconhecidos vão para o fim, mantendo ordem alfabética", () => {
    const sorted = sortAxesMaturity([
      axis("Inovação", 10, 1),
      axis("Cultura", 20, 1),
      axis("Governanca", 50, 2),
    ]);
    expect(sorted.map((a) => a.axisName)).toEqual([
      "Governanca",
      "Cultura",
      "Inovação",
    ]);
  });
});
