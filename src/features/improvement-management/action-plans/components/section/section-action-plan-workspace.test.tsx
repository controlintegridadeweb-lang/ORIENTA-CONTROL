// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import type { ActionPlanListItem } from "@/features/improvement-management/action-plans/types";
import { SectionActionPlanWorkspace } from "./section-action-plan-workspace";
import { SectionProblemSolutionTree } from "./section-problem-solution-tree";
import { SectionWorkspaceOverview } from "./section-workspace-overview";
import { SectionWorkspaceActions } from "./section-workspace-actions";
import { SectionWorkspaceMonitoring } from "./section-workspace-monitoring";
import {
  buildSectionActionPlanHierarchy,
  findSectionActionPlan,
  sectionActionPlanSourcesFromListItems,
} from "@/features/improvement-management/action-plans/section-action-plan-model";

const listAllActionPlansForCycle = vi.fn();

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

vi.mock("next/navigation", () => ({
  usePathname: () =>
    "/respondente/plano-acao/secao/44444444-4444-4444-8444-444444444444/visao-geral",
  useSearchParams: () =>
    new URLSearchParams(
      "cycleId=33333333-3333-4333-8333-333333333333&returnTo=%2Frespondente%2Fportfolio-recomendacoes%3Fview%3Daction-plan",
    ),
}));

vi.mock("@/features/improvement-management/action-plans/client", () => ({
  listAllActionPlansForCycle: (...args: unknown[]) => listAllActionPlansForCycle(...args),
}));

afterEach(() => {
  cleanup();
});

const SECTION_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_SECTION_ID = "77777777-7777-4777-8777-777777777777";
const CYCLE_ID = "33333333-3333-4333-8333-333333333333";
const REC_1 = "11111111-1111-4111-8111-111111111111";
const REC_2 = "55555555-5555-4555-8555-555555555555";
const RETURN_TO = "/respondente/portfolio-recomendacoes?view=action-plan";

function action(over: Partial<ActionPlanAction> = {}): ActionPlanAction {
  return {
    id: "plan-1",
    actionText: "Criar página institucional da UCI",
    startDate: "2026-04-01",
    dueDate: "2026-09-30",
    responsibleSector: "UCI",
    responsibleUserId: "user-1",
    responsibleName: "Unidade X",
    progressPercentage: 40,
    status: "in_progress",
    observations: null,
    updatedAt: "2026-08-12T12:00:00.000Z",
    revision: 1,
    documents: [],
    slaLabel: "ok",
    ...over,
  };
}

function listItem(over: Partial<ActionPlanListItem> = {}): ActionPlanListItem {
  return {
    recommendationId: REC_1,
    questionId: "22222222-2222-4222-8222-222222222222",
    cycleId: CYCLE_ID,
    cycleState: "validated",
    periodLabel: "2026",
    formId: "form-1",
    formName: "Diagnóstico de Integridade",
    formVersion: 1,
    organizationId: "org-1",
    organizationName: "Órgão Demo",
    questionPrompt: "As informações relativas à UCI estão devidamente divulgadas?",
    sectionId: SECTION_ID,
    sectionName: "Gestão da Transparência",
    sectionOrder: 1,
    questionOrder: 1,
    axisId: "axis-1",
    axisName: "Governança e Estrutura de Integridade",
    recommendationType: "nao_implementacao",
    recommendationText: "Promover a divulgação das informações relativas à UCI.",
    recommendationStatus: "in_action_plan",
    plans: [action()],
    slaLabel: "ok",
    ...over,
  };
}

function sectionFrom(items: ActionPlanListItem[]) {
  const hierarchy = buildSectionActionPlanHierarchy(sectionActionPlanSourcesFromListItems(items));
  const section = findSectionActionPlan(hierarchy, CYCLE_ID, SECTION_ID);
  if (!section) throw new Error("seção de teste não encontrada");
  return section;
}

const twoRecommendations = [
  listItem(),
  listItem({
    recommendationId: REC_2,
    questionId: "66666666-6666-4666-8666-666666666666",
    questionOrder: 2,
    questionPrompt: "As informações relativas ao CIC estão devidamente divulgadas?",
    recommendationText: "Promover a divulgação das informações relativas ao CIC.",
    plans: [
      action({
        id: "plan-2",
        actionText: "Publicar competências do CIC",
        progressPercentage: 100,
        status: "completed",
      }),
    ],
  }),
];

describe("SectionActionPlanWorkspace", () => {
  beforeEach(() => {
    listAllActionPlansForCycle.mockReset();
    listAllActionPlansForCycle.mockResolvedValue(twoRecommendations);
  });

  it("carrega o ciclo pelo papel autenticado e preserva returnTo nas abas", async () => {
    render(
      <SectionActionPlanWorkspace
        role="respondent"
        sectionId={SECTION_ID}
        cycleId={CYCLE_ID}
        activeTab="visao-geral"
        returnTo={RETURN_TO}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Detalhes da seção" })).toBeTruthy();
    });

    expect(listAllActionPlansForCycle).toHaveBeenCalledWith("respondent", CYCLE_ID);
    const treeTab = screen.getByRole("link", { name: "Problemas e soluções" });
    expect(treeTab.getAttribute("href")).toContain(`/secao/${SECTION_ID}/problemas-solucoes`);
    expect(treeTab.getAttribute("href")).toContain(`cycleId=${CYCLE_ID}`);
    expect(treeTab.getAttribute("href")).toContain("returnTo=");
    expect(treeTab.getAttribute("href")).not.toContain(REC_1);
    expect(screen.getByRole("link", { name: /Voltar ao Plano de integridade e compliance/i }).getAttribute("href")).toBe(
      RETURN_TO,
    );
  });

  it("respeita o endpoint administrativo sem abrir a primeira recomendação", async () => {
    render(
      <SectionActionPlanWorkspace
        role="admin"
        sectionId={SECTION_ID}
        cycleId={CYCLE_ID}
        activeTab="visao-geral"
        returnTo="/admin/plano-acao"
      />,
    );

    await waitFor(() => {
      expect(listAllActionPlansForCycle).toHaveBeenCalledWith("admin", CYCLE_ID);
    });
    expect(screen.getByRole("link", { name: "Visão geral" }).getAttribute("href")).toContain(
      `/admin/plano-acao/secao/${SECTION_ID}/visao-geral`,
    );
    expect(screen.getByRole("link", { name: "Visão geral" }).getAttribute("href")).not.toContain(REC_1);
  });
});

describe("SectionWorkspaceOverview", () => {
  it("mostra todas as perguntas e recomendações da seção", () => {
    render(<SectionWorkspaceOverview section={sectionFrom(twoRecommendations)} />);

    expect(screen.getByText("Perguntas de origem")).toBeTruthy();
    expect(screen.getAllByText("As informações relativas à UCI estão devidamente divulgadas?").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("As informações relativas ao CIC estão devidamente divulgadas?").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Promover a divulgação das informações relativas à UCI.")).toBeTruthy();
    expect(screen.getByText("Promover a divulgação das informações relativas ao CIC.")).toBeTruthy();
    expect(screen.getByText(/2 recomendações · 2 ações · 1 concluída/)).toBeTruthy();
  });
});

describe("SectionWorkspaceActions", () => {
  it("mantém as ações vinculadas à recomendação correta", () => {
    render(
      <SectionWorkspaceActions
        role="respondent"
        section={sectionFrom(twoRecommendations)}
        parentReturnTo={RETURN_TO}
      />,
    );

    expect(screen.getByText("Criar página institucional da UCI")).toBeTruthy();
    expect(screen.getByText("Publicar competências do CIC")).toBeTruthy();
    const manageLinks = screen.getAllByRole("link", { name: "Gerenciar ação" });
    expect(manageLinks[0]?.getAttribute("href")).toContain(`/plano-acao/${REC_1}/acoes`);
    expect(manageLinks[1]?.getAttribute("href")).toContain(`/plano-acao/${REC_2}/acoes`);
    expect(manageLinks[0]?.getAttribute("href")).toContain("returnTo=");
  });

  it("mostra o estado vazio quando a seção não tem ações", () => {
    render(
      <SectionWorkspaceActions
        role="respondent"
        section={sectionFrom([listItem({ plans: [] })])}
        parentReturnTo={RETURN_TO}
      />,
    );

    expect(
      screen.getByText("Nenhuma ação foi cadastrada para as recomendações desta seção."),
    ).toBeTruthy();
  });
});

describe("SectionWorkspaceMonitoring", () => {
  it("mostra apenas as ações da seção e o acompanhamento disponível no read model", () => {
    const mixed = [
      ...twoRecommendations,
      listItem({
        recommendationId: "88888888-8888-4888-8888-888888888888",
        questionId: "99999999-9999-4999-8999-999999999999",
        sectionId: OTHER_SECTION_ID,
        sectionName: "Outra seção",
        sectionOrder: 2,
        plans: [action({ id: "plan-other", actionText: "Ação de outra seção" })],
      }),
    ];

    render(
      <SectionWorkspaceMonitoring
        role="admin"
        section={sectionFrom(mixed)}
        parentReturnTo="/admin/plano-acao"
      />,
    );

    expect(screen.getByText("Criar página institucional da UCI")).toBeTruthy();
    expect(screen.getByText("Publicar competências do CIC")).toBeTruthy();
    expect(screen.queryByText("Ação de outra seção")).toBeNull();
    expect(screen.getAllByText("Unidade X").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nenhuma comprovação").length).toBe(2);
  });

  it("mostra o estado vazio quando não há ações para monitorar", () => {
    render(
      <SectionWorkspaceMonitoring
        role="respondent"
        section={sectionFrom([listItem({ plans: [] })])}
      />,
    );

    expect(screen.getByText("Não há ações para monitorar nesta seção")).toBeTruthy();
  });
});

describe("SectionProblemSolutionTree", () => {
  it("exibe a árvore apenas da seção carregada", () => {
    render(<SectionProblemSolutionTree section={sectionFrom(twoRecommendations)} />);

    const figure = screen.getByRole("figure");
    expect(figure.getAttribute("data-section-id")).toBe(SECTION_ID);
    expect(figure.textContent).toContain("As informações relativas à UCI estão devidamente divulgadas?");
    expect(figure.textContent).toContain("As informações relativas ao CIC estão devidamente divulgadas?");
    expect(figure.textContent).toContain("Criar página institucional da UCI");
    expect(figure.textContent).toContain("Publicar competências do CIC");
    expect(figure.textContent).not.toContain("Ação de outra seção");
    expect(document.querySelectorAll("[data-node='recomendacao']")).toHaveLength(2);
  });

  it("mostra o texto integral da pergunta, da recomendação e da ação", () => {
    const question =
      "As informações relativas à UCI estão devidamente divulgadas no sítio eletrônico institucional, incluindo competência, composição e normas internas?";
    const recommendation =
      "Promover a divulgação, no sítio eletrônico institucional, das informações relativas à Unidade de Controle Interno.";
    const actionText =
      "Adicionar as referidas informações no sítio eletrônico e revisar o conteúdo publicado a cada ciclo.";

    render(
      <SectionProblemSolutionTree
        section={sectionFrom([
          listItem({
            questionPrompt: question,
            recommendationText: recommendation,
            plans: [action({ actionText })],
          }),
        ])}
      />,
    );

    const pergunta = document.querySelector("[data-node='pergunta']");
    const recomendacao = document.querySelector("[data-node='recomendacao']");
    const acao = document.querySelector("[data-node='acao']");

    expect(pergunta?.textContent).toContain(question);
    expect(recomendacao?.textContent).toContain(recommendation);
    expect(acao?.textContent).toContain(actionText);
    expect(pergunta?.querySelector(".truncate")).toBeNull();
    expect(recomendacao?.querySelector(".truncate")).toBeNull();
    expect(acao?.querySelector(".line-clamp-2")).toBeNull();
  });

  it("mostra o estado vazio quando a seção não tem estrutura de recomendações", () => {
    const empty = sectionFrom(twoRecommendations);
    render(
      <SectionProblemSolutionTree
        section={{
          ...empty,
          recommendations: [],
          actions: [],
        }}
      />,
    );

    expect(
      screen.getByText("Nenhuma estrutura de problemas e soluções foi registrada para esta seção."),
    ).toBeTruthy();
  });
});
