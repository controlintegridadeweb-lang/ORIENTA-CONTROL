// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AdminUsuariosHero } from "./admin-usuarios-hero";

describe("AdminUsuariosHero", () => {
  afterEach(() => cleanup());

  it("usa o hero institucional da aba de usuários", () => {
    render(<AdminUsuariosHero />);

    expect(screen.getByLabelText("Usuários")).toBeTruthy();
    expect(screen.getByText("Acessos e perfis")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Usuários" })).toBeTruthy();
    expect(
      screen.getByText(
        "Crie e gerencie respondentes: edite nome, e-mail e organização vinculada, solicite a recuperação de senha ou remova contas. O perfil Respondente é fixo nesta área.",
      ),
    ).toBeTruthy();
  });
});
