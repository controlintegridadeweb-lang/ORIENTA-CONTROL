import { describe, expect, it } from "vitest";
import type { ActionPlanAction } from "./domain-model";
import {
  buildSectionActionPlanHierarchy,
  filterSectionHierarchyByMatchingRecommendations,
  findSectionActionPlan,
  isSectionRecommendationCompleted,
  sectionOriginQuestions,
} from "./section-action-plan-model";
import {
  actionNumberInSection,
  sectionExecutionSituationSummary,
  sectionRecommendationSituationSummary,
} from "./section-action-plan-copy";
import { sectionPlanStatusFromSection } from "./section-action-plan-status";

function action(
  id: string,
  progressPercentage: number,
  status: ActionPlanAction["status"],
  slaLabel: ActionPlanAction["slaLabel"] = "ok",
  extra: Partial<ActionPlanAction> = {},
): ActionPlanAction {
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
    createdAt: `2026-08-${id === "a1" ? "01" : "02"}T12:00:00.000Z`,
    updatedAt: `2026-08-${id === "a1" ? "01" : "02"}T12:00:00.000Z`,
    revision: 1,
    documents: [],
    slaLabel,
    ...extra,
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
        recommendationStatus: "completed",
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
        recommendationStatus: "in_action_plan",
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
      "2 recomendações · 1 em execução · 1 concluída",
    );
    expect(sectionPlanStatusFromSection(section!)).toBe("attention");
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

  it("não conclui a seção quando uma recomendação ainda está sem ação", () => {
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
        recommendationStatus: "completed",
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
        recommendationStatus: "generated",
        actions: [],
      },
    ]);
    const section = result[0]?.sections[0];
    expect(section?.metrics.progressPercentage).toBe(100);
    expect(sectionRecommendationSituationSummary(section!.recommendations)).toBe(
      "2 recomendações · 1 sem ação · 1 concluída",
    );
    expect(sectionPlanStatusFromSection(section!)).toBe("in_progress");
    expect(isSectionRecommendationCompleted(section!.recommendations[0]!)).toBe(true);
    expect(isSectionRecommendationCompleted(section!.recommendations[1]!)).toBe(false);
  });

  it("distingue execução encerrada de conclusão aceita", () => {
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
        questionPrompt: "Pergunta",
        recommendationText: "Recomendação",
        recommendationStatus: "awaiting_approval",
        actions: [action("a1", 100, "completed")],
      },
    ]);
    const section = result[0]?.sections[0];
    expect(section?.metrics.progressPercentage).toBe(100);
    expect(isSectionRecommendationCompleted(section!.recommendations[0]!)).toBe(false);
    expect(sectionRecommendationSituationSummary(section!.recommendations)).toBe(
      "1 recomendação · 1 aguardando aceite",
    );
    expect(sectionPlanStatusFromSection(section!)).toBe("awaiting_acceptance");
  });

  it("preserva exception_requested e adjustment_requested no resumo da seção", () => {
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
        recommendationStatus: "exception_requested",
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
        questionId: "q-2",
        questionOrder: 2,
        recommendationId: "rec-2",
        questionPrompt: "Pergunta 2",
        recommendationText: "Recomendação 2",
        recommendationStatus: "adjustment_requested",
        actions: [action("a2", 40, "in_progress")],
      },
    ]);
    const section = result[0]?.sections[0];
    expect(section?.recommendations.map((item) => item.recommendationStatus)).toEqual([
      "exception_requested",
      "adjustment_requested",
    ]);
    expect(sectionRecommendationSituationSummary(section!.recommendations)).toBe(
      "2 recomendações · 1 ajuste solicitado · 1 exceção em análise",
    );
    expect(sectionPlanStatusFromSection(section!)).toBe("in_progress");
  });

  it("mantém A1/A2 pela criação quando uma ação é atualizada depois", () => {
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
        questionPrompt: "Pergunta",
        recommendationText: "Recomendação",
        recommendationStatus: "in_action_plan",
        actions: [
          action("a1", 80, "in_progress", "ok", {
            createdAt: "2026-08-01T12:00:00.000Z",
            updatedAt: "2026-09-10T12:00:00.000Z",
          }),
          action("a2", 10, "not_started", "ok", {
            createdAt: "2026-08-02T12:00:00.000Z",
            updatedAt: "2026-08-02T12:00:00.000Z",
          }),
        ],
      },
    ]);
    const section = result[0]?.sections[0];
    expect(section?.actions.map((item) => item.id)).toEqual(["a1", "a2"]);
    expect(actionNumberInSection(section!, 0, 0)).toBe(1);
    expect(actionNumberInSection(section!, 0, 1)).toBe(2);
  });

  it("filtra seções encontradas sem recalcular o percentual do recorte", () => {
    const hierarchy = buildSectionActionPlanHierarchy([
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
        recommendationStatus: "in_action_plan",
        actions: [action("a1", 0, "not_started")],
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
        recommendationStatus: "completed",
        actions: [action("a2", 100, "completed")],
      },
      {
        cycleId: "cycle-1",
        formName: "Diagnóstico",
        periodLabel: "2026",
        organizationName: "Órgão",
        axisId: "gov",
        axisName: "Governança",
        sectionId: "outra",
        sectionName: "Outra seção",
        sectionOrder: 2,
        questionId: "q-3",
        questionOrder: 1,
        recommendationId: "rec-3",
        questionPrompt: "Pergunta 3",
        recommendationText: "Recomendação 3",
        recommendationStatus: "in_action_plan",
        actions: [action("a3", 20, "in_progress")],
      },
    ]);

    const filtered = filterSectionHierarchyByMatchingRecommendations(
      hierarchy,
      new Set(["rec-2"]),
    );
    const section = filtered[0]?.sections[0];

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.sections).toHaveLength(1);
    expect(section?.sectionId).toBe("integridade");
    expect(section?.recommendations).toHaveLength(2);
    expect(section?.metrics.progressPercentage).toBe(50);
  });
});
