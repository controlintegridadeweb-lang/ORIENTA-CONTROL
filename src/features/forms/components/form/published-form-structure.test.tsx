// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublishedFormStructureView } from "./published-form-structure";
import type { PublishedFormStructure } from "@/features/forms/published-structure-types";

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  pathname: "/admin/formularios/form-1/estrutura",
  params: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.params,
}));

function buildStructure(questionCount: number): PublishedFormStructure {
  return {
    formVersionId: "version-1",
    version: 3,
    publishedAt: "2026-01-15T12:00:00.000Z",
    questions: Array.from({ length: questionCount }, (_, index) => ({
      questionId: `q-${index + 1}`,
      questionVersion: 1,
      orderIndex: index,
      prompt: `Critério ${index + 1}`,
      evidenceRequired: index % 2 === 0,
      famiEnabled: true,
      appliesToRespondent: true,
      sectionId: `sec-${Math.floor(index / 5) + 1}`,
      sectionName: `Seção ${Math.floor(index / 5) + 1}`,
      sectionOrder: Math.floor(index / 5) + 1,
      axisId: index < 10 ? "axis-a" : "axis-b",
      axisName: index < 10 ? "Eixo A" : "Eixo B",
      metricName: null,
      metricDescription: null,
      recommendation: {
        title: `Rec ${index + 1}`,
        description: null,
        textoBaseFixo: "Texto base",
        textoBaseParametrizavel: null,
        tipo: "nao_implementacao",
      },
      bindingNote: null,
      coverageScore: null,
    })),
  };
}

describe("PublishedFormStructureView", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    navigation.replace.mockReset();
    navigation.params = new URLSearchParams();
  });

  it("não renderiza todas as perguntas de uma vez e preserva a numeração original", () => {
    render(<PublishedFormStructureView structure={buildStructure(12)} />);

    expect(
      screen.getByText((_, node) =>
        Boolean(
          node?.classList.contains("hidden") &&
            node.textContent?.includes("Exibindo 1–10 de 12 perguntas"),
        ),
      ),
    ).toBeTruthy();
    expect(screen.getByText("Critério 1")).toBeTruthy();
    expect(screen.getByText("Critério 10")).toBeTruthy();
    expect(screen.queryByText("Critério 11")).toBeNull();
    expect(screen.queryByText(/Total da estrutura:/)).toBeNull();
    expect(screen.getAllByLabelText("Paginação da estrutura publicada")).toHaveLength(1);
  });

  it("atualiza a URL ao mudar de página", () => {
    render(<PublishedFormStructureView structure={buildStructure(12)} />);

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(navigation.replace).toHaveBeenCalledWith(
      "/admin/formularios/form-1/estrutura?page=2",
      { scroll: false },
    );
    expect(screen.queryByLabelText("Por página")).toBeNull();
  });
});
