import { describe, expect, it } from "vitest";
import type { LibrarySection } from "@/features/library";
import { groupLibrarySectionsByAxis } from "./form-questions-configurator-helpers";

function section(
  partial: Pick<LibrarySection, "id" | "axisId" | "axisCode" | "name" | "ordem">,
): LibrarySection {
  return {
    code: partial.axisCode,
    description: null,
    status: "published",
    versionMajor: 1,
    versionMinor: 0,
    versionPatch: 0,
    version: "1.0.0",
    vigenteDe: null,
    vigenteAte: null,
    tags: [],
    createdBy: null,
    updatedBy: null,
    approvedBy: null,
    approvedAt: null,
    deprecatedBy: null,
    deprecatedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("groupLibrarySectionsByAxis", () => {
  it("agrupa na ordem institucional e preserva a ordem da seção dentro do eixo", () => {
    const groups = groupLibrarySectionsByAxis(
      [
        section({
          id: "soc-2",
          axisId: "ax-soc",
          axisCode: "SOC",
          name: "Equidade",
          ordem: 8,
        }),
        section({
          id: "amb-1",
          axisId: "ax-amb",
          axisCode: "AMB",
          name: "Compliance Ambiental",
          ordem: 4,
        }),
        section({
          id: "gov-2",
          axisId: "ax-gov",
          axisCode: "GOV",
          name: "Planejamento",
          ordem: 2,
        }),
        section({
          id: "gov-1",
          axisId: "ax-gov",
          axisCode: "GOV",
          name: "Integridade",
          ordem: 1,
        }),
        section({
          id: "soc-1",
          axisId: "ax-soc",
          axisCode: "SOC",
          name: "Qualidade de Vida",
          ordem: 6,
        }),
      ],
      [
        { id: "ax-soc", name: "Social", code: "SOC", ordem: 2 } as never,
        { id: "ax-amb", name: "Ambiental", code: "AMB", ordem: 1 } as never,
        { id: "ax-gov", name: "Governança", code: "GOV", ordem: 0 } as never,
      ],
    );

    expect(groups.map((group) => group.axisName)).toEqual([
      "Governança",
      "Ambiental",
      "Social",
    ]);
    expect(groups.map((group) => group.sections.map((item) => item.id))).toEqual([
      ["gov-1", "gov-2"],
      ["amb-1"],
      ["soc-1", "soc-2"],
    ]);
  });
});
