// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RespondentRecommendationItem } from "@/features/improvement-management/recommendations/respondent-presentation";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { RespondentSectionActionPlanList } from "./respondent-section-action-plan-list";

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

afterEach(() => {
  cleanup();
});

const SECTION_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_SECTION_ID = "77777777-7777-4777-8777-777777777777";
const CYCLE_ID = "33333333-3333-4333-8333-333333333333";
const REC_1 = "11111111-1111-4111-8111-111111111111";
const REC_2 = "55555555-5555-4555-8555-555555555555";
const RETURN_PATH = "/respondente/portfolio-recomendacoes?view=action-plan";

function action(over: Partial<ActionPlanAction> = {}): ActionPlanAction {
  return {
    id: "plan-1",
    actionText: "Publicar competências e contatos",
    startDate: "2026-04-01",
    dueDate: "2026-09-30",
    responsibleSector: "UCI",
    responsibleUserId: "user-1",
    responsibleName: "Unidade X",
    progressPercentage: 0,
    status: "not_started",
    observations: null,
    updatedAt: "2026-08-12T12:00:00.000Z",
    revision: 1,
    documents: [],
    slaLabel: "ok",
    ...over,
  };
}

function item(over: Partial<RespondentRecommendationItem> = {}): RespondentRecommendationItem {
  return {
    recommendationId: REC_1,
    questionId: "22222222-2222-4222-8222-222222222222",
    cycleId: CYCLE_ID,
    cycleState: "validated",
    canCreateActionPlan: true,
    periodLabel: "2026",
    formId: "form-1",
    formName: "Diagnóstico de Integridade",
    formVersion: 1,
    organizationId: "org-1",
    organizationName: "Órgão Demo",
    axisId: "axis-1",
    axisName: "Governança e Estrutura de Integridade",
    sectionId: SECTION_ID,
    sectionName: "Gestão da Transparência",
    sectionOrder: 1,
    questionOrder: 1,
    questionPrompt: "As informações relativas à UCI estão devidamente divulgadas?",
    recommendationText: "Promover a divulgação das informações relativas à UCI.",
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

describe("RespondentSectionActionPlanList", () => {
  it("abre o plano da seção pelo sectionId e exibe todas as perguntas", () => {
    render(
      <RespondentSectionActionPlanList
        returnPath={RETURN_PATH}
        items={[
          item(),
          item({
            recommendationId: REC_2,
            questionId: "66666666-6666-4666-8666-666666666666",
            questionOrder: 2,
            questionPrompt: "As informações relativas ao CIC estão devidamente divulgadas?",
            recommendationText: "Promover a divulgação das informações relativas ao CIC.",
            status: "in_action_plan",
            hasPlan: true,
            actionCount: 1,
            plans: [action()],
          }),
        ]}
      />,
    );

    const open = screen.getByRole("link", { name: /Abrir plano da seção/i });
    expect(open.getAttribute("href")).toContain(`/secao/${SECTION_ID}/acoes`);
    expect(open.getAttribute("href")).toContain(`cycleId=${CYCLE_ID}`);
    expect(open.getAttribute("href")).toContain("returnTo=");
    expect(open.getAttribute("href")).not.toContain(REC_1);
    expect(open.getAttribute("href")).not.toContain(REC_2);
    expect(screen.getByText("Perguntas de origem")).toBeTruthy();
    expect(screen.getByText("As informações relativas à UCI estão devidamente divulgadas?")).toBeTruthy();
    expect(screen.getByText("As informações relativas ao CIC estão devidamente divulgadas?")).toBeTruthy();
    expect(screen.getByText("2 recomendações · 1 sem ação · 1 em execução")).toBeTruthy();
  });

  it("usa o singular quando a seção tem uma pergunta de origem", () => {
    render(<RespondentSectionActionPlanList returnPath={RETURN_PATH} items={[item()]} />);

    expect(screen.getByText("Pergunta de origem")).toBeTruthy();
    expect(screen.queryByText("Perguntas de origem")).toBeNull();
    expect(screen.getByRole("link", { name: /Abrir plano da seção/i }).getAttribute("href")).toContain(
      `/secao/${SECTION_ID}/acoes`,
    );
  });

  it("não mistura perguntas de outra seção", () => {
    render(
      <RespondentSectionActionPlanList
        returnPath={RETURN_PATH}
        items={[
          item(),
          item({
            recommendationId: REC_2,
            questionId: "66666666-6666-4666-8666-666666666666",
            sectionId: OTHER_SECTION_ID,
            sectionName: "Comitê Interno",
            sectionOrder: 2,
            questionPrompt: "Pergunta de outra seção",
          }),
        ]}
      />,
    );

    const links = screen.getAllByRole("link", { name: /Abrir plano da seção/i });
    expect(links[0]?.getAttribute("href")).toContain(`/secao/${SECTION_ID}/acoes`);
    expect(links[1]?.getAttribute("href")).toContain(`/secao/${OTHER_SECTION_ID}/acoes`);
    expect(screen.getByText("Pergunta de outra seção")).toBeTruthy();
    expect(screen.getByText("As informações relativas à UCI estão devidamente divulgadas?")).toBeTruthy();
  });

  it("preserva o percentual integral da seção quando o filtro recorta recomendações", () => {
    const allItems = [
      item({
        status: "in_action_plan",
        hasPlan: true,
        actionCount: 1,
        plans: [action({ progressPercentage: 0, status: "not_started" })],
      }),
      item({
        recommendationId: REC_2,
        questionId: "66666666-6666-4666-8666-666666666666",
        questionOrder: 2,
        questionPrompt: "As informações relativas ao CIC estão devidamente divulgadas?",
        recommendationText: "Promover a divulgação das informações relativas ao CIC.",
        status: "completed",
        hasPlan: true,
        actionCount: 1,
        plans: [action({ id: "plan-2", progressPercentage: 100, status: "completed" })],
      }),
    ];

    render(
      <RespondentSectionActionPlanList
        returnPath={RETURN_PATH}
        items={allItems}
        matchingItems={[allItems[1]!]}
      />,
    );

    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.queryByText("100%")).toBeNull();
    expect(screen.getByText("2 recomendações · 1 em execução · 1 concluída")).toBeTruthy();
    expect(screen.getByText("As informações relativas à UCI estão devidamente divulgadas?")).toBeTruthy();
    expect(screen.getByText("As informações relativas ao CIC estão devidamente divulgadas?")).toBeTruthy();
  });

  it("lista todas as ações dos eixos e seções com o setor responsável", () => {
    render(
      <RespondentSectionActionPlanList
        returnPath={RETURN_PATH}
        items={[
          item({
            status: "in_action_plan",
            hasPlan: true,
            actionCount: 1,
            plans: [action({ actionText: "Publicar competências da UCI", responsibleSector: "UCI" })],
          }),
          item({
            recommendationId: REC_2,
            questionId: "66666666-6666-4666-8666-666666666666",
            sectionId: OTHER_SECTION_ID,
            sectionName: "Comitê Interno",
            sectionOrder: 2,
            questionPrompt: "Pergunta de outra seção",
            status: "in_action_plan",
            hasPlan: true,
            actionCount: 1,
            plans: [
              action({
                id: "plan-2",
                actionText: "Registrar atas do comitê",
                responsibleSector: "CIC",
              }),
            ],
          }),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Todas as ações" }));

    expect(screen.getByText("2 ações de todos os eixos e seções.")).toBeTruthy();
    expect(screen.getByText("Publicar competências da UCI")).toBeTruthy();
    expect(screen.getByText("Registrar atas do comitê")).toBeTruthy();
    expect(screen.getByText("UCI")).toBeTruthy();
    expect(screen.getByText("CIC")).toBeTruthy();
    expect(screen.getByText("Seção 1. Gestão da Transparência")).toBeTruthy();
    expect(screen.getByText("Seção 2. Comitê Interno")).toBeTruthy();
    const links = screen.getAllByRole("link", { name: /Abrir plano da seção/i });
    expect(links).toHaveLength(2);
    expect(links[0]?.getAttribute("href")).toContain(`/secao/${SECTION_ID}/acoes`);
    expect(links[1]?.getAttribute("href")).toContain(`/secao/${OTHER_SECTION_ID}/acoes`);
    const progressLinks = screen.getAllByRole("link", { name: "Andamento" });
    expect(progressLinks[0]?.getAttribute("href")).toContain(`/secao/${SECTION_ID}/acoes`);
    expect(progressLinks[0]?.getAttribute("href")).toContain("action=plan-1");
    expect(progressLinks[0]?.getAttribute("href")).toContain("panel=progress");
    expect(progressLinks[1]?.getAttribute("href")).toContain(`/secao/${OTHER_SECTION_ID}/acoes`);
    expect(progressLinks[1]?.getAttribute("href")).toContain("action=plan-2");
    const manageLinks = screen.getAllByRole("link", { name: "Gerenciar ação" });
    expect(manageLinks).toHaveLength(2);
    expect(manageLinks[0]?.getAttribute("href")).toContain(`/secao/${SECTION_ID}/acoes`);
    expect(manageLinks[0]?.getAttribute("href")).toContain("action=plan-1");
    expect(manageLinks[0]?.getAttribute("href")).not.toContain(REC_1);
    expect(manageLinks[1]?.getAttribute("href")).toContain(`/secao/${OTHER_SECTION_ID}/acoes`);
    expect(manageLinks[1]?.getAttribute("href")).toContain("action=plan-2");
  });

  it("pagina todas as ações de dez em dez", () => {
    const plans = Array.from({ length: 11 }, (_, index) => {
      const order = String(index + 1).padStart(2, "0");
      return action({
        id: `plan-${order}`,
        actionText: `Ação ${order}`,
        createdAt: `2026-04-${order}T12:00:00.000Z`,
      });
    });

    render(
      <RespondentSectionActionPlanList
        returnPath={RETURN_PATH}
        items={[
          item({
            status: "in_action_plan",
            hasPlan: true,
            actionCount: plans.length,
            plans,
          }),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Todas as ações" }));

    expect(screen.getByText("11 ações de todos os eixos e seções.")).toBeTruthy();
    const pagination = screen.getByRole("navigation", { name: "Paginação de ações" });
    expect(pagination.textContent).toContain("Página");
    expect(pagination.textContent).toContain("1");
    expect(pagination.textContent).toContain("2");
    expect(pagination.textContent).toContain("exibindo");
    expect(pagination.textContent).toContain("10");
    expect(pagination.textContent).toContain("11");
    expect(pagination.textContent).toContain("ações");
    expect(screen.getByText("Ação 01")).toBeTruthy();
    expect(screen.getByText("Ação 10")).toBeTruthy();
    expect(screen.queryByText("Ação 11")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

    expect(screen.getByText("Ação 11")).toBeTruthy();
    expect(screen.queryByText("Ação 01")).toBeNull();
    expect(screen.queryByText("Ação 10")).toBeNull();
  });
});
