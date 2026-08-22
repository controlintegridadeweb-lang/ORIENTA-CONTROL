import { describe, expect, it } from "vitest";
import type { AdminPlanItem } from "@/features/improvement-management/action-plans/admin-monitoring";
import type { AdminRecommendationItem } from "@/features/improvement-management/recommendations/admin-presentation";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { computeActionSla } from "@/features/improvement-management/action-plans/domain-model";
import { RECOMMENDATION_PORTFOLIO_EXPORT_HEADERS } from "@/features/improvement-management/recommendations/export";
import { actionPlansCsv, recommendationsCsv } from "./csv";

function makePlan(overrides: Partial<AdminPlanItem> = {}): AdminPlanItem {
  return {
    rowKey: "rec-1:plan-1",
    recommendationId: "rec-1",
    questionId: "question-1",
    planId: "plan-1",
    organizationId: "org-1",
    organizationName: "Org 1",
    formId: "form-1",
    cycleId: "cycle-1",
    periodLabel: "2026",
    formName: "Diagnóstico",
    formVersion: 1,
    axisId: "11111111-1111-4111-8111-111111111111",
    axisName: "Governança",
    sectionId: "22222222-2222-4222-8222-222222222222",
    sectionName: "Estrutura",
    questionPrompt: "Pergunta",
    recommendationText: "Recomendação",
    recommendationType: "negative_answer",
    recommendationStatus: "generated",
    actionText: "Ação válida",
    planStatus: "not_started",
    view: "not_started",
    riskScore: 0,
    risk: "healthy",
    hasPlan: true,
    responsibleName: "Ana",
    responsibleSector: "Planejamento",
    sectionOrder: 1,
    questionOrder: 1,
    startDate: "2026-07-01",
    dueDate: "2026-08-01",
    updatedAt: "2026-07-11T12:00:00.000Z",
    lastActivityLabel: "11/07/2026",
    isOverdue: false,
    isDueSoon: false,
    progress: 0,
    observations: null,
    totalActionsForRecommendation: 1,
    slaLabel: "ok",
    ...overrides,
  };
}

function makeAction(
  over: Partial<Omit<ActionPlanAction, "slaLabel">> & Pick<ActionPlanAction, "id">,
): ActionPlanAction {
  const base = {
    actionText: "Ação",
    startDate: "2026-07-01",
    dueDate: "2026-08-01",
    responsibleSector: "Planejamento",
    responsibleUserId: null,
    responsibleName: "Ana",
    progressPercentage: 0,
    status: "not_started" as const,
    observations: null,
    updatedAt: "2026-07-11T12:00:00.000Z",
    revision: 1,
    documents: [] as ActionPlanAction["documents"],
    ...over,
  };
  return { ...base, slaLabel: computeActionSla(base) };
}

function makeRecommendation(
  over: Partial<AdminRecommendationItem> = {},
): AdminRecommendationItem {
  return {
    recommendationId: "rec-1",
    questionId: "question-1",
    plans: [],
    planId: null,
    organizationId: "org-1",
    organizationName: "Org 1",
    formId: "form-1",
    cycleId: "cycle-1",
    cycleState: "validated",
    canCreateActionPlan: true,
    periodLabel: "2026",
    formName: "Diagnóstico",
    formVersion: 1,
    axisId: "axis-1",
    axisName: "Governança",
    sectionId: "section-1",
    sectionName: "Estrutura",
    sectionOrder: 1,
    questionOrder: 1,
    questionPrompt: "Pergunta",
    recommendationText: "Recomendação",
    recommendationType: "negative_answer",
    recommendationStatus: "generated",
    planStatus: null,
    hasPlan: false,
    isOverdue: false,
    isDueSoon: false,
    progress: 0,
    startDate: null,
    dueDate: null,
    responsibleName: null,
    responsibleSector: null,
    updatedAt: null,
    recommendationCreatedAt: null,
    ...over,
  };
}

describe("actionPlansCsv", () => {
  it("usa o vocabulário oficial nos cabeçalhos", () => {
    const { content } = actionPlansCsv([makePlan()]);

    expect(content).toContain("Situação de acompanhamento");
    expect(content).toContain("Situação da ação");
    expect(content).not.toContain("Status administrativo");
    expect(content).not.toContain("Status persistido");
  });

  it("neutraliza células que poderiam ser interpretadas como fórmula", () => {
    const { content } = actionPlansCsv(
      [makePlan({ organizationName: "=HYPERLINK(\"https://example.test\")" })],
    );

    expect(content).toContain("'=");
    expect(content).not.toContain(";=HYPERLINK");
  });
});

describe("recommendationsCsv", () => {
  it("usa a ordem canônica do portfólio e uma linha por ação", () => {
    const { content, filename } = recommendationsCsv([
      makeRecommendation({
        recommendationId: "rec-1",
        plans: [
          makeAction({ id: "a1", actionText: "Ação A", dueDate: "2026-10-01" }),
          makeAction({ id: "a2", actionText: "Ação B", dueDate: "2026-12-01" }),
        ],
        hasPlan: true,
        recommendationStatus: "in_action_plan",
      }),
    ]);

    const lines = content.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
    expect(lines[0]?.split(";")).toEqual([...RECOMMENDATION_PORTFOLIO_EXPORT_HEADERS]);
    expect(lines).toHaveLength(3);
    expect(content).toContain("Ação A");
    expect(content).toContain("Ação B");
    expect(content).toContain("Órgão");
    expect(content).toContain("Pergunta de origem");
    expect(content).not.toContain("Plano?");
    expect(filename).toMatch(/^portfolio-recomendacoes-/);
  });

  it("mantém recomendação sem ações no arquivo", () => {
    const { content } = recommendationsCsv([makeRecommendation()]);
    const lines = content.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
    expect(lines).toHaveLength(2);
    expect(content).toContain("Gerada");
  });
});
