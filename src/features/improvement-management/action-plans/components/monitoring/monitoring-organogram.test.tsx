// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { MonitoringOrganogram } from "./monitoring-organogram";

afterEach(() => {
  cleanup();
});

function plan(over: Partial<ActionPlanAction> = {}): ActionPlanAction {
  return {
    id: "plan-1",
    actionText: "Publicar informações no portal institucional",
    startDate: "2026-04-01",
    dueDate: "2026-09-30",
    responsibleSector: "Unidade X",
    responsibleUserId: "user-1",
    responsibleName: "Unidade X",
    progressPercentage: 45,
    status: "in_progress",
    observations: null,
    updatedAt: "2026-08-12",
    revision: 1,
    documents: [],
    slaLabel: "ok",
    ...over,
  };
}

describe("MonitoringOrganogram", () => {
  it("desenha eixo, seção, recomendação e as ações", () => {
    render(
      <MonitoringOrganogram
        axisName="Governança"
        sectionName="Transparência"
        recommendationText="Formalizar o acompanhamento institucional"
        plans={[
          plan(),
          plan({
            id: "plan-2",
            actionText: "Capacitar a equipe responsável pelo registro",
            progressPercentage: 0,
            status: "not_started",
          }),
        ]}
        selectedPlanId="plan-1"
        onSelectAction={vi.fn()}
      />,
    );

    const figure = screen.getByRole("figure");
    const diagram = figure.textContent ?? "";

    expect(screen.getByRole("heading", { name: "Árvore de problemas e soluções" })).toBeTruthy();
    expect(figure.getAttribute("aria-label")).toBe(
      "Árvore de problemas e soluções: Governança → Transparência → Formalizar o acompanhamento institucional → 2 ação(ões)",
    );
    expect(diagram.indexOf("Governança")).toBeLessThan(diagram.indexOf("Transparência"));
    expect(diagram.indexOf("Transparência")).toBeLessThan(
      diagram.indexOf("Formalizar o acompanhamento institucional"),
    );
    expect(diagram.indexOf("Formalizar o acompanhamento institucional")).toBeLessThan(
      diagram.indexOf("Publicar informações no portal institucional"),
    );
    expect(screen.getByText("Eixo")).toBeTruthy();
    expect(screen.getByText("Seção")).toBeTruthy();
    expect(screen.getByText("Recomendação")).toBeTruthy();
    expect(screen.getAllByText("Ação")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: /Publicar informações no portal institucional/ }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: /Capacitar a equipe responsável pelo registro/ }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("seleciona a ação clicada no organograma", () => {
    const onSelectAction = vi.fn();
    render(
      <MonitoringOrganogram
        axisName="Governança"
        sectionName="Transparência"
        recommendationText="Formalizar o acompanhamento institucional"
        plans={[
          plan(),
          plan({
            id: "plan-2",
            actionText: "Capacitar a equipe responsável pelo registro",
            progressPercentage: 0,
            status: "not_started",
          }),
        ]}
        selectedPlanId="plan-1"
        onSelectAction={onSelectAction}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Capacitar a equipe responsável pelo registro/ }),
    );
    expect(onSelectAction).toHaveBeenCalledWith("plan-2");
  });

  it("mostra o texto integral da recomendação e da ação", () => {
    const recommendation =
      "Promover a divulgação, no sítio eletrônico institucional, das informações relativas à Unidade de Controle Interno.";
    const actionText =
      "Adicionar as referidas informações no sítio eletrônico e revisar o conteúdo publicado a cada ciclo.";

    render(
      <MonitoringOrganogram
        axisName="Governança"
        sectionName="Governança e Estrutura de Integridade"
        recommendationText={recommendation}
        plans={[plan({ actionText })]}
        selectedPlanId="plan-1"
        onSelectAction={vi.fn()}
      />,
    );

    expect(document.querySelector("[data-node='recomendacao']")?.textContent).toContain(recommendation);
    expect(document.querySelector("[data-node='acao']")?.textContent).toContain(actionText);
    expect(document.querySelector("[data-node='recomendacao'] .truncate")).toBeNull();
    expect(document.querySelector("[data-node='acao'] .line-clamp-2")).toBeNull();
  });

  it("mostra progresso e prazo na ação", () => {
    render(
      <MonitoringOrganogram
        axisName="Ambiental"
        sectionName="A3P"
        recommendationText="Formalizar o acompanhamento institucional"
        plans={[plan({ slaLabel: "due_soon" })]}
        selectedPlanId="plan-1"
        onSelectAction={vi.fn()}
      />,
    );

    expect(screen.getByText("45% · Em andamento")).toBeTruthy();
    expect(screen.getByText("Próxima do vencimento.")).toBeTruthy();
  });

  it("ramifica as ações em linha sob a recomendação", () => {
    render(
      <MonitoringOrganogram
        axisName="Governança"
        sectionName="Transparência"
        recommendationText="Formalizar o acompanhamento institucional"
        plans={Array.from({ length: 5 }, (_, index) =>
          plan({
            id: `plan-${index + 1}`,
            actionText: `Ação ${index + 1}`,
          }),
        )}
        selectedPlanId="plan-1"
        onSelectAction={vi.fn()}
      />,
    );

    expect(document.querySelector('[data-layout="organogram-tree"]')).toBeTruthy();
    expect(document.querySelector('[data-node="eixo"]')).toBeTruthy();
    expect(document.querySelector('[data-node="secao"]')).toBeTruthy();
    expect(document.querySelector('[data-node="recomendacao"]')).toBeTruthy();
    expect(screen.queryByText("5 ações vinculadas")).toBeNull();
    expect(screen.getAllByText("Ação")).toHaveLength(5);
    const actionNodes = [...document.querySelectorAll("[data-node='acao']")];
    expect(actionNodes).toHaveLength(5);
    expect(new Set(actionNodes.map((node) => node.className)).size).toBe(1);
    expect(actionNodes[0]?.className).toContain("w-80");
    expect(actionNodes[0]?.className).toContain("h-full");
    expect(
      actionNodes.every((node) => node.querySelector(".whitespace-pre-wrap")),
    ).toBe(true);
  });

  it("pinta o fluxo com a paleta do eixo", () => {
    render(
      <MonitoringOrganogram
        axisName="Ambiental"
        sectionName="A3P"
        recommendationText="Formalizar o acompanhamento institucional"
        plans={[plan()]}
        selectedPlanId="plan-1"
        onSelectAction={vi.fn()}
      />,
    );

    const eixo = document.querySelector("[data-node='eixo']") as HTMLElement;
    const secao = document.querySelector("[data-node='secao']") as HTMLElement;
    const recomendacao = document.querySelector("[data-node='recomendacao']") as HTMLElement;

    expect(eixo.className).toContain("rounded-full");
    expect(secao.className).toContain("rounded-xl");
    expect(eixo.style.backgroundColor.replaceAll(" ", "")).toMatch(/#15803[Dd]|rgb\(21,128,61\)/i);
    expect(secao.style.backgroundColor.replaceAll(" ", "")).toMatch(/#16[Aa]34[Aa]|rgb\(22,163,74\)/i);
    expect(recomendacao.style.backgroundColor.replaceAll(" ", "")).toMatch(
      /#B5[Ee]4[Cc]6|rgb\(181,228,198\)/i,
    );
  });
});
