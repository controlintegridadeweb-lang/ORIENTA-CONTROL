// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminBibliotecaHero } from "./admin-library-hero";

describe("AdminBibliotecaHero", () => {
  afterEach(() => cleanup());

  it("descreve a biblioteca como gestão de seções ESG", () => {
    render(<AdminBibliotecaHero onNewSection={vi.fn()} />);

    expect(screen.getByText("Biblioteca Geral")).toBeTruthy();
    expect(screen.getByText("Catálogo institucional")).toBeTruthy();
    expect(
      screen.getByText(
        "Gerencie seções e conteúdos reutilizáveis dos eixos ESG da plataforma.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Nova seção/i })).toBeTruthy();
    expect(screen.queryByText("Modelos de recomendação")).toBeNull();
  });
});
