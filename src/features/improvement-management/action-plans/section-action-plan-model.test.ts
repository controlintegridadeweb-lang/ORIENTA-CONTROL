import { describe, expect, it } from "vitest";
import type { ActionPlanAction } from "./domain-model";
import {
  buildSectionActionPlanHierarchy,
  findSectionActionPlan,
  sectionOriginQuestions,
} from "./section-action-plan-model";
import {
  sectionExecutionSituationSummary,
  sectionRecommendationSituationSummary,
} from "./section-action-plan-copy";

function action(id: string, progressPercentage: number, status: ActionPlanAction["status"], slaLabel: ActionPlanAction["slaLabel"] = "ok"): ActionPlanAction {
  return {
    id,
    actionText: `Ação ${id}`,
    startDate: "2026-08-01",
    dueDate: "2026-10-01",
    responsibleSector: "Unidade",
    responsibleUserId: null,
    responsibleName: "Responsável",
    progressPercentage,
    status,
    observations: null,
    updatedAt: `2026-08-${id === "a1" ? "01" : "02"}T12:00:00.000Z`,
    revision: 1,
    documents: [],
    slaLabel,
  };
}

describe("buildSectionActionPlanHierarchy", () => {
  it("agrega ações de recomendações diferentes no mesmo plano da seção sem perder a origem", () => {
    const result = buildSectionActionPlanHierarchy([
      {
        cycleId: "cycle-1",
        formName: "Diagnóstico",
        periodLabel: "2026",
        organizationName: "Órgão",
        axisId: "gov",
        axisName: "Governança",
        sectionId: "integridade",
        sectionName: "Integridade",
        sectionOrder: 1,
        questionId: "q-1",
        questionOrder: 1,
        recommendationId: "rec-1",
        questionPrompt: "Pergunta 1",
        recommendationText: "Recomendação 1",
        actions: [action("a1", 100, "completed")],
      },
      {
        cycleId: "cycle-1",
        formName: "Diagnóstico",
        periodLabel: "2026",
        organizationName: "Órgão",
        axisId: "gov",
        axisName: "Governança",
        sectionId: "integridade",
        sectionName: "Integridade",
        sectionOrder: 1,
        questionId: "q-2",
        questionOrder: 2,
        recommendationId: "rec-2",
        questionPrompt: "Pergunta 2",
        recommendationText: "Recomendação 2",
        actions: [action("a2", 50, "in_progress", "overdue")],
      },
    ]);

    const section = result[0]?.sections[0];
    expect(section?.recommendations).toHaveLength(2);
    expect(section?.actions.map((item) => [item.id, item.recommendationId])).toEqual([
      ["a1", "rec-1"],
      ["a2", "rec-2"],
    ]);
    expect(section?.metrics).toMatchObject({
      totalActions: 2,
      completedActions: 1,
      inProgressActions: 1,
      overdueActions: 1,
      progressPercentage: 75,
    });
    expect(sectionOriginQuestions(section!)).toEqual([
      { id: "q-1", prompt: "Pergunta 1", order: 1 },
      { id: "q-2", prompt: "Pergunta 2", order: 2 },
    ]);
    expect(sectionExecutionSituationSummary(section!)).toBe("2 recomendações · 2 ações · 1 concluída");
    expect(sectionRecommendationSituationSummary(section!.recommendations)).toBe(
      "2 recomendações · 1 concluída",
    );
    expect(findSectionActionPlan(result, "cycle-1", "integridade")?.sectionId).toBe("integridade");
  });

  it("deduplica perguntas de origem pelo questionId e não pela ordem do array", () => {
    const result = buildSectionActionPlanHierarchy([
      {
        cycleId: "cycle-1",
        formName: "Diagnóstico",
        periodLabel: "2026",
        organizationName: "Órgão",
        axisId: "gov",
        axisName: "Governança",
        sectionId: "integridade",
        sectionName: "Integridade",
        sectionOrder: 1,
        questionId: "q-shared",
        questionOrder: 2,
        recommendationId: "rec-2",
        questionPrompt: "Pergunta compartilhada",
        recommendationText: "Recomendação 2",
        actions: [],
      },
      {
        cycleId: "cycle-1",
        formName: "Diagnóstico",
        periodLabel: "2026",
        organizationName: "Órgão",
        axisId: "gov",
        axisName: "Governança",
        sectionId: "integridade",
        sectionName: "Integridade",
        sectionOrder: 1,
        questionId: "q-shared",
        questionOrder: 2,
        recommendationId: "rec-1",
        questionPrompt: "Pergunta compartilhada",
        recommendationText: "Recomendação 1",
        actions: [],
      },
    ]);
    const section = result[0]?.sections[0];
    expect(section?.recommendations).toHaveLength(2);
    expect(sectionOriginQuestions(section!)).toEqual([
      { id: "q-shared", prompt: "Pergunta compartilhada", order: 2 },
    ]);
  });

  it("não mistura a mesma seção entre ciclos diferentes", () => {
    const common = {
      formName: "Diagnóstico",
      organizationName: "Órgão",
      axisId: "gov",
      axisName: "Governança",
      sectionId: "integridade",
      sectionName: "Integridade",
      sectionOrder: 1,
      questionId: "q-1",
      questionOrder: 1,
      questionPrompt: "Pergunta",
      recommendationText: "Recomendação",
      actions: [] as ActionPlanAction[],
    };
    const result = buildSectionActionPlanHierarchy([
      { ...common, cycleId: "cycle-1", periodLabel: "2026", recommendationId: "rec-1" },
      { ...common, cycleId: "cycle-2", periodLabel: "2027", recommendationId: "rec-2" },
    ]);
    expect(result).toHaveLength(2);
  });
});
