import { describe, expect, it } from "vitest";
import type { FamiSectionSnapshot } from "@/features/fami/queries";
import { sortFamiSections } from "./respondent-section-sort";

function section(
  sectionId: string,
  percentage: number,
  maturityLevel: number | null,
): FamiSectionSnapshot {
  return {
    sectionId,
    sectionName: sectionId,
    sectionOrder: 0,
    axisId: "axis",
    axisName: "Governanca",
    percentage,
    maturityLevel,
    pointsObtained: maturityLevel == null ? 0 : percentage,
    pointsPossible: maturityLevel == null ? 0 : 100,
  };
}

describe("sortFamiSections", () => {
  it("mantém seções N/A após resultados aplicáveis em qualquer direção", () => {
    const rows = [section("N/A", 0, null), section("Baixo", 20, 1), section("Alto", 80, 4)];

    expect(sortFamiSections(rows, "percentage", "asc").map((row) => row.sectionId))
      .toEqual(["Baixo", "Alto", "N/A"]);
    expect(sortFamiSections(rows, "percentage", "desc").map((row) => row.sectionId))
      .toEqual(["Alto", "Baixo", "N/A"]);
  });

  it("ordena seções N/A alfabeticamente entre si", () => {
    const rows = [section("N/A B", 0, null), section("Aplicável", 50, 3), section("N/A A", 0, null)];

    expect(sortFamiSections(rows, "level", "desc").map((row) => row.sectionId))
      .toEqual(["Aplicável", "N/A A", "N/A B"]);
  });
});
