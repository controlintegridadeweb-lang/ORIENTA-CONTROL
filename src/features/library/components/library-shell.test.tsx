// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BibliotecaShell } from "./library-shell";
import type { LibraryCatalogSnapshot } from "@/features/library/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const EMPTY_SNAPSHOT: LibraryCatalogSnapshot = {
  axes: [],
  sections: [
    {
      id: "sec-1",
      axisId: "axis-1",
      axisCode: "AMB",
      code: "AMB-01",
      name: "Gestão ambiental",
      description: null,
      ordem: 1,
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
    },
  ],
  recommendations: [
    {
      id: "rec-1",
      code: "REC-01",
      title: "Modelo oculto",
      description: null,
      tipo: "nao_implementacao",
      textoBaseFixo: null,
      textoBaseParametrizavel: null,
      variaveisParametro: [],
      fundamentoTecnico: null,
      escopoAplicacao: null,
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
    },
  ],
};

describe("BibliotecaShell", () => {
  afterEach(() => cleanup());

  it("exibe somente seções, sem abas nem modelos de recomendação", () => {
    render(
      <BibliotecaShell
        initial={EMPTY_SNAPSHOT}
        layout="admin"
        initialView={{ search: "", status: "all", tag: "", page: 1 }}
      />,
    );

    expect(screen.getByText("Biblioteca Geral")).toBeTruthy();
    expect(
      screen.getByText(
        "Gerencie seções e conteúdos reutilizáveis dos eixos ESG da plataforma.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Seções")).toBeTruthy();
    expect(screen.getByText("Gestão ambiental")).toBeTruthy();
    expect(screen.queryByText("Modelos de recomendação")).toBeNull();
    expect(screen.queryByText("Modelo oculto")).toBeNull();
    expect(screen.queryByLabelText("Abas da Biblioteca Geral")).toBeNull();
  });
});
