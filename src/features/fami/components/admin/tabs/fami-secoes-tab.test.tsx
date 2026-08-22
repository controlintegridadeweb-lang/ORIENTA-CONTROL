// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { FamiSnapshotNonNull } from "../fami-maturity-helpers";
import { FamiSecoesTab } from "./fami-secoes-tab";

afterEach(() => cleanup());

function snapshotWithSections(
  sections: FamiSnapshotNonNull["sections"],
): FamiSnapshotNonNull {
  return {
    formId: "form-1",
    organizationId: "org-1",
    processingVersion: 1,
    policyVersion: "v1",
    global: null,
    axes: [],
    sections,
  };
}

describe("FamiSecoesTab", () => {
  it("exibe eixos como cabeçalhos e seções na ordem oficial do formulário", () => {
    render(
      <FamiSecoesTab
        snapshot={snapshotWithSections([
          {
            sectionId: "s-soc",
            sectionName: "Equidade de Gênero e Raça",
            sectionOrder: 8,
            axisId: "ax-soc",
            axisName: "Social",
            percentage: 50,
            maturityLevel: 3,
            pointsObtained: 10,
            pointsPossible: 20,
          },
          {
            sectionId: "s-gov",
            sectionName: "Planejamento Organizacional",
            sectionOrder: 2,
            axisId: "ax-gov",
            axisName: "Governança",
            percentage: 58.5,
            maturityLevel: 3,
            pointsObtained: 11.7,
            pointsPossible: 20,
          },
          {
            sectionId: "s-amb",
            sectionName: "Adoção da Agenda Ambiental",
            sectionOrder: 5,
            axisId: "ax-amb",
            axisName: "Ambiental",
            percentage: 22.6,
            maturityLevel: 2,
            pointsObtained: 4.5,
            pointsPossible: 20,
          },
        ])}
      />,
    );

    expect(screen.getByText("Governança")).toBeTruthy();
    expect(screen.getByText("Ambiental")).toBeTruthy();
    expect(screen.getByText("Social")).toBeTruthy();
    expect(screen.queryByText("Eixo 1")).toBeNull();
    expect(screen.queryByText("Ordenar:")).toBeNull();

    const table = screen.getByRole("table");
    const bodyText = table.textContent ?? "";
    expect(bodyText.indexOf("Planejamento Organizacional")).toBeLessThan(
      bodyText.indexOf("Adoção da Agenda Ambiental"),
    );
    expect(bodyText.indexOf("Adoção da Agenda Ambiental")).toBeLessThan(
      bodyText.indexOf("Equidade de Gênero e Raça"),
    );

    expect(screen.getByText("58.5%")).toBeTruthy();
    expect(screen.getByText("22.6%")).toBeTruthy();
    expect(screen.getByText("11.70")).toBeTruthy();
    expect(within(table).getByText("2")).toBeTruthy();
  });
});
