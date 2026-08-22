// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResolvedCriterionAdministrativeActions } from "../administrative-actions";
import { CriterionAdministrativeActions } from "./CriterionAdministrativeActions";

const naContext = {
  responseId: "response-1",
  questionPrompt: "O órgão possui ouvidoria?",
  answer: "no" as const,
  documents: [],
};

afterEach(() => cleanup());

describe("CriterionAdministrativeActions", () => {
  it("com apenas N/A, mostra botão e nota de histórico sem container explicativo", () => {
    const actions: ResolvedCriterionAdministrativeActions = {
      primaryActions: [],
      canMarkNotApplicable: true,
    };
    render(
      <CriterionAdministrativeActions
        actions={actions}
        markNotApplicable={{
          context: naContext,
          onSubmit: vi.fn(),
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Marcar como “Não se aplica”/i }),
    ).toBeTruthy();
    expect(
      screen.getByText(/A resposta original será preservada no histórico/i),
    ).toBeTruthy();
    expect(
      screen.queryByText(/Critério elegível a classificação administrativa/i),
    ).toBeNull();
    expect(
      screen.queryByText(/A resposta “Não” permanece registrada/i),
    ).toBeNull();
  });

  it("exibe a explicação apenas no painel de confirmação do N/A", () => {
    const actions: ResolvedCriterionAdministrativeActions = {
      primaryActions: [],
      canMarkNotApplicable: true,
    };
    render(
      <CriterionAdministrativeActions
        actions={actions}
        markNotApplicable={{
          context: naContext,
          onSubmit: vi.fn(),
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Marcar como “Não se aplica”/i }),
    );

    expect(
      screen.getByText(/Critério elegível a classificação administrativa/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/A resposta “Não” permanece registrada/i),
    ).toBeTruthy();
  });

  it("com evidência + N/A, mantém o bloco Validação e N/A após o divisor", () => {
    const actions: ResolvedCriterionAdministrativeActions = {
      primaryActions: ["approve", "invalidate", "request_adjustment"],
      canMarkNotApplicable: true,
    };
    const onSelect = vi.fn();
    render(
      <CriterionAdministrativeActions
        actions={actions}
        primary={{ onSelect, choiceStyle: "evidence" }}
        markNotApplicable={{
          context: { ...naContext, answer: "yes" },
          onSubmit: vi.fn(),
        }}
      />,
    );

    expect(screen.getByText("Validação")).toBeTruthy();
    expect(
      screen.getByText(/Justificativa é obrigatória para insuficiência ou ajuste/i),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Aprovar evidência" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Considerar insuficiente" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Solicitar ajuste" }),
    ).toBeTruthy();
    expect(
      screen.getByText(/A resposta original será preservada no histórico/i),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Marcar como “Não se aplica”/i }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Aprovar evidência" }));
    expect(onSelect).toHaveBeenCalledWith("approve");
  });

  it("omite ações não resolvidas sem alterar a estrutura do rodapé", () => {
    const actions: ResolvedCriterionAdministrativeActions = {
      primaryActions: ["approve"],
      canMarkNotApplicable: false,
    };
    render(
      <CriterionAdministrativeActions
        actions={actions}
        primary={{ onSelect: vi.fn(), choiceStyle: "evidence" }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Aprovar evidência" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Considerar insuficiente" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Marcar como “Não se aplica”/i }),
    ).toBeNull();
    expect(
      screen.queryByText(/A resposta original será preservada no histórico/i),
    ).toBeNull();
  });

  it("aplica peso visual primário à aprovação / validar sem comprovação", () => {
    const actions: ResolvedCriterionAdministrativeActions = {
      primaryActions: ["validate_without_proof", "consider_insufficient"],
      canMarkNotApplicable: false,
    };
    render(
      <CriterionAdministrativeActions
        actions={actions}
        showValidationIntro={false}
        primary={{ onSelect: vi.fn(), choiceStyle: "evidence" }}
      />,
    );

    const primary = screen.getByRole("button", {
      name: "Validar sem comprovação",
    });
    const secondary = screen.getByRole("button", {
      name: "Considerar o critério insuficiente",
    });
    expect(primary.className).not.toEqual(secondary.className);
    expect(primary.className).toMatch(/bg-brand/);
  });
});
