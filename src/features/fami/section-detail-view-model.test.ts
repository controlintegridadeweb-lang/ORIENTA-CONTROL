import { describe, expect, it } from "vitest";
import { AXIS_COLORS, colorForAxisName } from "./fami-axis-display";
import type { FamiSectionSnapshot } from "./read-types";
import {
  buildSectionDetailRows,
  groupSectionDetailRowsByAxis,
  sortSectionsByFormOrder,
} from "./section-detail-view-model";

function section(
  partial: Pick<
    FamiSectionSnapshot,
    "sectionId" | "sectionName" | "sectionOrder" | "axisId" | "axisName"
  > &
    Partial<FamiSectionSnapshot>,
): FamiSectionSnapshot {
  return {
    percentage: partial.percentage ?? 50,
    maturityLevel: partial.maturityLevel === undefined ? 3 : partial.maturityLevel,
    pointsObtained: partial.pointsObtained ?? 10,
    pointsPossible: partial.pointsPossible ?? 20,
    ...partial,
  };
}

describe("sortSectionsByFormOrder", () => {
  it("ordena por eixo estrutural e depois por section_order oficial", () => {
    const sorted = sortSectionsByFormOrder([
      section({
        sectionId: "s-soc-2",
        sectionName: "Equidade",
        sectionOrder: 8,
        axisId: "ax-soc",
        axisName: "Social",
      }),
      section({
        sectionId: "s-amb-1",
        sectionName: "Compliance Ambiental",
        sectionOrder: 4,
        axisId: "ax-amb",
        axisName: "Ambiental",
      }),
      section({
        sectionId: "s-gov-2",
        sectionName: "Planejamento",
        sectionOrder: 2,
        axisId: "ax-gov",
        axisName: "Governança",
      }),
      section({
        sectionId: "s-gov-1",
        sectionName: "Integridade",
        sectionOrder: 1,
        axisId: "ax-gov",
        axisName: "Governança",
      }),
      section({
        sectionId: "s-soc-1",
        sectionName: "Qualidade de Vida",
        sectionOrder: 6,
        axisId: "ax-soc",
        axisName: "Social",
      }),
    ]);

    expect(sorted.map((row) => row.sectionId)).toEqual([
      "s-gov-1",
      "s-gov-2",
      "s-amb-1",
      "s-soc-1",
      "s-soc-2",
    ]);
  });

  it("não ordena alfabeticamente quando a ordem oficial diverge do nome", () => {
    const sorted = sortSectionsByFormOrder([
      section({
        sectionId: "b",
        sectionName: "AAA",
        sectionOrder: 2,
        axisId: "ax-gov",
        axisName: "Governanca",
      }),
      section({
        sectionId: "a",
        sectionName: "ZZZ",
        sectionOrder: 1,
        axisId: "ax-gov",
        axisName: "Governanca",
      }),
    ]);
    expect(sorted.map((row) => row.sectionId)).toEqual(["a", "b"]);
  });
});

describe("buildSectionDetailRows", () => {
  it("vincula cada seção ao eixo correto e preserva dados numéricos", () => {
    const rows = buildSectionDetailRows([
      section({
        sectionId: "s1",
        sectionName: "Planejamento Organizacional",
        sectionOrder: 2,
        axisId: "ax-gov",
        axisName: "Governança",
        percentage: 58.5,
        maturityLevel: 3,
        pointsObtained: 11.7,
        pointsPossible: 20,
      }),
      section({
        sectionId: "s2",
        sectionName: "A3P",
        sectionOrder: 5,
        axisId: "ax-amb",
        axisName: "Ambiental",
        percentage: 22.6,
        maturityLevel: 2,
        pointsObtained: 4.5,
        pointsPossible: 20,
      }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      axisId: "ax-gov",
      axisLabel: "Governança",
      axisOrder: 1,
      formOrder: 2,
      sectionLabel: "Planejamento Organizacional",
      percentage: 58.5,
      maturityLevel: 3,
      maturityLevelLabel: "Nível 3",
      pointsEarned: 11.7,
      pointsPossible: 20,
      axisColorKey: "governance",
    });
    expect(rows[1]).toMatchObject({
      axisId: "ax-amb",
      axisLabel: "Ambiental",
      axisOrder: 2,
      formOrder: 5,
      axisColorKey: "environmental",
      percentage: 22.6,
      pointsEarned: 4.5,
    });
  });
});

describe("groupSectionDetailRowsByAxis", () => {
  it("agrupa seções sob cabeçalhos de eixo na ordem oficial", () => {
    const groups = groupSectionDetailRowsByAxis(
      buildSectionDetailRows([
        section({
          sectionId: "s-soc",
          sectionName: "Diversidade",
          sectionOrder: 7,
          axisId: "ax-soc",
          axisName: "Social",
        }),
        section({
          sectionId: "s-gov",
          sectionName: "Integridade",
          sectionOrder: 1,
          axisId: "ax-gov",
          axisName: "Governança",
        }),
        section({
          sectionId: "s-amb",
          sectionName: "A3P",
          sectionOrder: 4,
          axisId: "ax-amb",
          axisName: "Ambiental",
        }),
      ]),
    );

    expect(groups.map((group) => `Eixo ${group.axisOrder} — ${group.axisLabel}`)).toEqual([
      "Eixo 1 — Governança",
      "Eixo 2 — Ambiental",
      "Eixo 3 — Social",
    ]);
    expect(groups[0]?.sections.map((row) => row.sectionId)).toEqual(["s-gov"]);
    expect(groups[1]?.sections.map((row) => row.sectionId)).toEqual(["s-amb"]);
    expect(groups[2]?.sections.map((row) => row.sectionId)).toEqual(["s-soc"]);
  });
});

describe("cores por eixo no detalhamento", () => {
  it("mapeia Governança/Ambiental/Social para azul/verde/rosa", () => {
    expect(colorForAxisName("Governança")).toBe(AXIS_COLORS.governance.accent);
    expect(colorForAxisName("Ambiental")).toBe(AXIS_COLORS.environmental.accent);
    expect(colorForAxisName("Social")).toBe(AXIS_COLORS.social.accent);
    expect(AXIS_COLORS.governance.accent).toBe("#0097B2");
    expect(AXIS_COLORS.environmental.accent).toBe("#16A34A");
    expect(AXIS_COLORS.social.accent).toBe("#DB2777");
  });
});
