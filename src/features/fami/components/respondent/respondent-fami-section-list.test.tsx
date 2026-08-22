// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { FamiSectionSnapshot } from "@/features/fami/queries";
import { RespondentFamiSectionList } from "./respondent-fami-section-list";

afterEach(() => cleanup());

function section(
  partial: Pick<
    FamiSectionSnapshot,
    "sectionId" | "sectionName" | "sectionOrder" | "axisId" | "axisName" | "percentage"
  >,
): FamiSectionSnapshot {
  return {
    maturityLevel: 3,
    pointsObtained: 10,
    pointsPossible: 20,
    ...partial,
  };
}

describe("RespondentFamiSectionList", () => {
  it("usa a mesma organização por eixo e ordem do formulário que o admin", () => {
    render(
      <RespondentFamiSectionList
        sections={[
          section({
            sectionId: "s-amb",
            sectionName: "A3P",
            sectionOrder: 4,
            axisId: "ax-amb",
            axisName: "Ambiental",
            percentage: 100,
          }),
          section({
            sectionId: "s-gov",
            sectionName: "Planejamento Organizacional",
            sectionOrder: 2,
            axisId: "ax-gov",
            axisName: "Governança",
            percentage: 80,
          }),
          section({
            sectionId: "s-soc",
            sectionName: "Diversidade",
            sectionOrder: 7,
            axisId: "ax-soc",
            axisName: "Social",
            percentage: 60,
          }),
        ]}
      />,
    );

    expect(screen.getByText("Detalhamento por seção")).toBeTruthy();
    expect(screen.getByText("Governança")).toBeTruthy();
    expect(screen.getByText("Ambiental")).toBeTruthy();
    expect(screen.getByText("Social")).toBeTruthy();
    expect(screen.queryByText("Ordenar:")).toBeNull();
    expect(screen.queryByText("Pontuação")).toBeNull();

    const table = screen.getByRole("table");
    const bodyText = table.textContent ?? "";
    expect(bodyText.indexOf("Planejamento Organizacional")).toBeLessThan(bodyText.indexOf("A3P"));
    expect(bodyText.indexOf("A3P")).toBeLessThan(bodyText.indexOf("Diversidade"));
  });
});
