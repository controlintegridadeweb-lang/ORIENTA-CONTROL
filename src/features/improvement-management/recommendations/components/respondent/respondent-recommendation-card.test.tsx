// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RespondentRecommendationItem } from "@/features/improvement-management/recommendations/respondent-presentation";
import { toRecommendationCardViewModel } from "./recommendation-card-view-model";
import { RespondentRecommendationCard } from "./respondent-recommendation-card";
import { RespondentRecommendationList } from "./respondent-recommendation-list";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

function item(over: Partial<RespondentRecommendationItem> = {}): RespondentRecommendationItem {
  return {
    recommendationId: "11111111-1111-4111-8111-111111111111",
    questionId: "22222222-2222-4222-8222-222222222222",
    cycleId: "33333333-3333-4333-8333-333333333333",
    cycleState: "validated",
    canCreateActionPlan: true,
    periodLabel: "2026",
    formId: "form-1",
    formName: "Diagnóstico de Integridade",
    formVersion: 1,
    organizationId: "org-1",
    organizationName: "Órgão Demo",
    axisId: "axis-1",
    axisName: "Governança",
    sectionId: "section-1",
    sectionName: "Gestão da Transparência",
    sectionOrder: 1,
    questionOrder: 1,
    questionPrompt:
      "Os responsáveis pela transparência e acesso à informação possuem capacitação compatível com as atribuições exercidas?",
    recommendationText:
      "Promover a capacitação dos servidores responsáveis pela transparência e acesso à informação, especialmente em temas relacionados à Lei de Acesso à Informação, transparência pública e gestão da informação.",
    recommendationType: "nao_implementacao",
    status: "generated",
    planStatus: null,
    hasPlan: false,
    progress: 0,
    needsAction: true,
    actionCount: 0,
    slaLabel: "na",
    createdAt: null,
    updatedAt: null,
    plan: null,
    plans: [],
    ...over,
  };
}

describe("RespondentRecommendationCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("ordena formulário → pergunta → recomendação → situação no DOM", () => {
    const viewModel = toRecommendationCardViewModel(item(), "/respondente/recomendacoes", {
      recommendationDisplayCode: "1.1",
    });
    const { container } = render(<RespondentRecommendationCard viewModel={viewModel} />);

    const article = container.querySelector("article");
    expect(article).toBeTruthy();
    const html = article!.textContent ?? "";
    const formIndex = html.indexOf("Formulário");
    const questionIndex = html.indexOf("Pergunta de origem");
    const recommendationLabelIndex = html.indexOf("Recomendação 1.1");
    const questionTextIndex = html.indexOf("capacitação compatível");
    const recommendationTextIndex = html.indexOf("Promover a capacitação");
    const situationIndex = html.indexOf("Situação");

    expect(formIndex).toBeGreaterThan(-1);
    expect(questionIndex).toBeGreaterThan(formIndex);
    expect(recommendationLabelIndex).toBeGreaterThan(questionIndex);
    expect(questionTextIndex).toBeGreaterThan(questionIndex);
    expect(recommendationTextIndex).toBeGreaterThan(questionTextIndex);
    expect(situationIndex).toBeGreaterThan(recommendationTextIndex);
  });

  it("usa o rótulo Pergunta de origem", () => {
    const viewModel = toRecommendationCardViewModel(item(), "/respondente/recomendacoes");
    render(<RespondentRecommendationCard viewModel={viewModel} />);
    expect(screen.getByRole("heading", { name: "Pergunta de origem" })).toBeTruthy();
    expect(screen.queryByText("Critério de origem")).toBeNull();
  });

  it("não concatena órgão no bloco de formulário", () => {
    const viewModel = toRecommendationCardViewModel(item(), "/respondente/recomendacoes");
    render(<RespondentRecommendationCard viewModel={viewModel} />);
    expect(screen.getByText(/Diagnóstico de Integridade 2026 · Versão 1/)).toBeTruthy();
    expect(screen.queryByText(/· Corpo de Bombeiros/i)).toBeNull();
  });

  it("mostra o texto completo da recomendação uma única vez", () => {
    const recommendationText =
      "Promover a capacitação dos servidores responsáveis pela transparência e acesso à informação, especialmente em temas relacionados à Lei de Acesso à Informação, transparência pública e gestão da informação.";
    const viewModel = toRecommendationCardViewModel(
      item({ recommendationText }),
      "/respondente/recomendacoes",
    );
    const { container } = render(<RespondentRecommendationCard viewModel={viewModel} />);

    const matches = within(container).getAllByText(recommendationText);
    expect(matches).toHaveLength(1);
    expect(container.textContent?.includes("…")).toBe(false);
  });

  it("não exibe controle de detalhes sem conteúdo secundário", () => {
    const viewModel = toRecommendationCardViewModel(item(), "/respondente/recomendacoes");
    render(<RespondentRecommendationCard viewModel={viewModel} />);
    expect(screen.queryByRole("button", { name: /informações adicionais/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /ocultar detalhes/i })).toBeNull();
  });

  it("exibe Cadastrar ações sem plano e muda o CTA com ações", () => {
    const withoutPlan = toRecommendationCardViewModel(item(), "/respondente/recomendacoes");
    const { rerender } = render(<RespondentRecommendationCard viewModel={withoutPlan} />);
    expect(screen.getByRole("link", { name: /Cadastrar ações/i })).toBeTruthy();
    expect(screen.getByText("Aguardando cadastro de ações")).toBeTruthy();
    expect(screen.queryByText("Em andamento")).toBeNull();

    const withPlan = toRecommendationCardViewModel(
      item({
        status: "in_action_plan",
        hasPlan: true,
        actionCount: 1,
        progress: 20,
      }),
      "/respondente/recomendacoes",
    );
    rerender(<RespondentRecommendationCard viewModel={withPlan} />);
    expect(screen.getByRole("link", { name: /Continuar plano de ação/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Cadastrar ações/i })).toBeNull();
  });

  it("permite expandir detalhes secundários por teclado", () => {
    const viewModel = toRecommendationCardViewModel(
      item({
        status: "in_action_plan",
        hasPlan: true,
        actionCount: 1,
        plan: {
          id: "plan-1",
          actionText: "ação",
          startDate: "2099-01-01",
          dueDate: "2099-01-01",
          responsibleSector: "TI",
          responsibleUserId: "55555555-5555-4555-8555-555555555555",
          responsibleName: "Alice",
          progressPercentage: 10,
          status: "in_progress",
          observations: "Histórico administrativo",
          updatedAt: "2025-06-10T10:00:00Z",
          revision: 1,
          documents: [],
          slaLabel: "ok",
        },
      }),
      "/respondente/recomendacoes",
    );

    render(<RespondentRecommendationCard viewModel={viewModel} />);

    const toggle = screen.getByRole("button", { name: /Ver informações adicionais/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBeTruthy();
    toggle.focus();
    expect(document.activeElement).toBe(toggle);
    fireEvent.keyDown(toggle, { key: "Enter", code: "Enter" });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Histórico administrativo")).toBeTruthy();
  });
});

describe("RespondentRecommendationList", () => {
  afterEach(() => {
    cleanup();
  });

  it("associa cada card à recomendação correta na hierarquia eixo/seção", () => {
    render(
      <RespondentRecommendationList
        returnPath="/respondente/recomendacoes"
        items={[
          item({
            recommendationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            questionPrompt: "Critério A?",
            recommendationText: "Recomendação A completa.",
          }),
          item({
            recommendationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            questionPrompt: "Critério B?",
            recommendationText: "Recomendação B completa.",
            recommendationType: "evidencia_insuficiente",
          }),
        ]}
      />,
    );

    const axisHeading = screen.getByRole("heading", { name: "Governança" });
    expect(axisHeading).toBeTruthy();
    expect(axisHeading.closest("header")?.style.backgroundColor.replaceAll(" ", "")).toMatch(
      /#E5F4F7|rgb\(229,244,247\)/i,
    );
    expect(
      screen.getByRole("heading", { name: /Seção 1 — Gestão da Transparência/i }),
    ).toBeTruthy();
    expect(screen.getByText("Critério A?")).toBeTruthy();
    expect(screen.getByText("Recomendação A completa.")).toBeTruthy();
    expect(screen.getByText("Critério B?")).toBeTruthy();
    expect(screen.getByText("Recomendação B completa.")).toBeTruthy();
  });
});
