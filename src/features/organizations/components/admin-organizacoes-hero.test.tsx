// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AdminOrganizacoesHero } from "./admin-organizacoes-hero";

describe("AdminOrganizacoesHero", () => {
  afterEach(() => cleanup());

  it("usa o hero institucional da aba de organizações", () => {
    render(<AdminOrganizacoesHero />);

    expect(screen.getByLabelText("Organizações")).toBeTruthy();
    expect(screen.getByText("Cadastro institucional")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Organizações" })).toBeTruthy();
    expect(
      screen.getByText(
        "Cadastre e consulte as organizações avaliadas. Cada respondente pertence a exatamente uma organização; administradores têm visão global.",
      ),
    ).toBeTruthy();
  });
});
