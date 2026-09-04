// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
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
            hasPlan: true,
            actionCount: 1,
            plans: [action()],
          }),
        ]}
      />,
    );

    const open = screen.getByRole("link", { name: /Abrir plano da seção/i });
    expect(open.getAttribute("href")).toContain(`/secao/${SECTION_ID}/visao-geral`);
    expect(open.getAttribute("href")).toContain(`cycleId=${CYCLE_ID}`);
    expect(open.getAttribute("href")).toContain("returnTo=");
    expect(open.getAttribute("href")).not.toContain(REC_1);
    expect(open.getAttribute("href")).not.toContain(REC_2);
    expect(screen.getByText("Perguntas de origem")).toBeTruthy();
    expect(screen.getByText("As informações relativas à UCI estão devidamente divulgadas?")).toBeTruthy();
    expect(screen.getByText("As informações relativas ao CIC estão devidamente divulgadas?")).toBeTruthy();
    expect(screen.getByText("2 recomendações · 0 concluídas")).toBeTruthy();
  });

  it("usa o singular quando a seção tem uma pergunta de origem", () => {
    render(<RespondentSectionActionPlanList returnPath={RETURN_PATH} items={[item()]} />);

    expect(screen.getByText("Pergunta de origem")).toBeTruthy();
    expect(screen.queryByText("Perguntas de origem")).toBeNull();
    expect(screen.getByRole("link", { name: /Abrir plano da seção/i }).getAttribute("href")).toContain(
      `/secao/${SECTION_ID}/visao-geral`,
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
    expect(links[0]?.getAttribute("href")).toContain(`/secao/${SECTION_ID}/visao-geral`);
    expect(links[1]?.getAttribute("href")).toContain(`/secao/${OTHER_SECTION_ID}/visao-geral`);
    expect(screen.getByText("Pergunta de outra seção")).toBeTruthy();
    expect(screen.getByText("As informações relativas à UCI estão devidamente divulgadas?")).toBeTruthy();
  });
});
