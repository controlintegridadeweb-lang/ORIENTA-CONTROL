// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminPlanItem } from "@/features/improvement-management/action-plans/admin-monitoring";
import { AdminActionPlanList } from "./admin-action-plan-list";

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
  usePathname: () => "/admin/plano-acao",
  useSearchParams: () => new URLSearchParams("organizationId=org-1"),
}));

afterEach(() => {
  cleanup();
});

const SECTION_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_SECTION_ID = "77777777-7777-4777-8777-777777777777";
const CYCLE_ID = "33333333-3333-4333-8333-333333333333";
const REC_1 = "11111111-1111-4111-8111-111111111111";
const REC_2 = "55555555-5555-4555-8555-555555555555";

function item(over: Partial<AdminPlanItem> = {}): AdminPlanItem {
  return {
    rowKey: "rec-1:plan-1",
    recommendationId: REC_1,
    questionId: "44444444-4444-4444-8444-444444444444",
    planId: "plan-1",
    organizationId: "org-1",
    organizationName: "Órgão Demo",
    formId: "form-1",
    cycleId: CYCLE_ID,
    periodLabel: "2026",
    formName: "Diagnóstico de Integridade",
    formVersion: 1,
    axisId: "axis-1",
    axisName: "Governança",
    sectionId: SECTION_ID,
    sectionName: "Governança e Estrutura de Integridade",
    sectionOrder: 1,
    questionOrder: 1,
    questionPrompt: "As informações relativas à UCI estão devidamente divulgadas?",
    recommendationText: "Promover a divulgação das informações relativas à UCI.",
    recommendationType: "nao_implementacao",
    recommendationStatus: "in_action_plan",
    view: "not_started",
    riskScore: 10,
    risk: "low",
    hasPlan: true,
    isOverdue: false,
    isDueSoon: false,
    planStatus: "not_started",
    actionText: "Publicar informações no sítio eletrônico",
    observations: null,
    responsibleName: "Unidade X",
    responsibleSector: "UCI",
    startDate: "2026-04-01",
    dueDate: "2026-09-30",
    updatedAt: "2026-08-12T12:00:00.000Z",
    lastActivityLabel: "Há 1 dia",
    progress: 0,
    totalActionsForRecommendation: 1,
    slaLabel: "ok",
    ...over,
  };
}

describe("AdminActionPlanList", () => {
  it("agrupa ações da mesma seção e abre o plano pelo sectionId", () => {
    render(
      <AdminActionPlanList
        items={[
          item(),
          item({
            rowKey: "rec-2:plan-2",
            recommendationId: REC_2,
            questionId: "66666666-6666-4666-8666-666666666666",
            planId: "plan-2",
            questionOrder: 2,
            questionPrompt: "As informações relativas ao CIC estão devidamente divulgadas?",
            recommendationText: "Promover a divulgação das informações relativas ao CIC.",
            actionText: "Publicar competências do CIC",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Eixo")).toBeTruthy();
    expect(screen.getByText("Governança")).toBeTruthy();
    expect(screen.getByText("Órgão Demo · Diagnóstico de Integridade · 2026")).toBeTruthy();
    expect(screen.getByText("Governança e Estrutura de Integridade")).toBeTruthy();
    expect(screen.getByText("Perguntas de origem")).toBeTruthy();
    expect(screen.getByText("As informações relativas à UCI estão devidamente divulgadas?")).toBeTruthy();
    expect(screen.getByText("As informações relativas ao CIC estão devidamente divulgadas?")).toBeTruthy();
    expect(screen.getByText("2 recomendações · 0 concluídas")).toBeTruthy();

    const open = screen.getByRole("link", { name: /Abrir plano da seção/i });
    expect(open.getAttribute("href")).toContain(`/admin/plano-acao/secao/${SECTION_ID}/visao-geral`);
    expect(open.getAttribute("href")).toContain(`cycleId=${CYCLE_ID}`);
    expect(open.getAttribute("href")).toContain("returnTo=");
    expect(open.getAttribute("href")).not.toContain(REC_1);
    expect(open.getAttribute("href")).not.toContain(REC_2);
  });

  it("não mistura seções e omite o órgão quando a visão já agrupa por organização", () => {
    render(
      <AdminActionPlanList
        hideOrganization
        items={[
          item(),
          item({
            rowKey: "rec-2:plan-2",
            recommendationId: REC_2,
            questionId: "66666666-6666-4666-8666-666666666666",
            planId: "plan-2",
            sectionId: OTHER_SECTION_ID,
            sectionName: "Comitê Interno",
            sectionOrder: 2,
            questionPrompt: "Pergunta de outra seção",
            actionText: "Ação de outra seção",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Diagnóstico de Integridade · 2026")).toBeTruthy();
    expect(screen.queryByText("Órgão Demo · Diagnóstico de Integridade · 2026")).toBeNull();
    const links = screen.getAllByRole("link", { name: /Abrir plano da seção/i });
    expect(links).toHaveLength(2);
    expect(links[0]?.getAttribute("href")).toContain(`/secao/${SECTION_ID}/visao-geral`);
    expect(links[1]?.getAttribute("href")).toContain(`/secao/${OTHER_SECTION_ID}/visao-geral`);
    expect(screen.getByText("Pergunta de outra seção")).toBeTruthy();
    expect(screen.getByText("As informações relativas à UCI estão devidamente divulgadas?")).toBeTruthy();
  });
});
