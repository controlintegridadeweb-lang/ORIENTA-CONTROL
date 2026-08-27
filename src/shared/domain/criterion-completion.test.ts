import { describe, expect, it } from "vitest";
import {
  evaluateCriterionCompletion,
  isActionEffectivelyCompleted,
  type ActionCompletionSnapshot,
} from "./criterion-completion";

function action(
  overrides: Partial<ActionCompletionSnapshot> = {},
): ActionCompletionSnapshot {
  return {
    status: "todo",
    progressPercentage: 0,
    approved: false,
    hasOpenAdjustment: false,
    hasRequiredEvidence: false,
    requiresEvidence: false,
    ...overrides,
  };
}

describe("conclusão efetiva do critério", () => {
  it("progresso 0% não conclui o critério", () => {
    const result = evaluateCriterionCompletion({
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [action({ status: "todo", progressPercentage: 0 })],
    });
    expect(result.criterionCompleted).toBe(false);
    expect(result.completedActionCount).toBe(0);
  });

  it("progresso 50% não conclui o critério", () => {
    expect(
      isActionEffectivelyCompleted(
        action({ status: "doing", progressPercentage: 50 }),
      ),
    ).toBe(false);
  });

  it("progresso 99% não conclui o critério", () => {
    expect(
      isActionEffectivelyCompleted(
        action({ status: "doing", progressPercentage: 99 }),
      ),
    ).toBe(false);
  });

  it("100% sem aceite não conclui o critério", () => {
    const result = evaluateCriterionCompletion({
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [action({ status: "done", progressPercentage: 100, approved: false })],
    });
    expect(result.criterionCompleted).toBe(false);
    expect(result.blockReasons).toContain("action_not_approved");
  });

  it("concluído sem comprovação necessária não conclui o critério", () => {
    const result = evaluateCriterionCompletion({
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [
        action({
          status: "done",
          progressPercentage: 100,
          approved: true,
          requiresEvidence: true,
          hasRequiredEvidence: false,
        }),
      ],
    });
    expect(result.criterionCompleted).toBe(false);
    expect(result.blockReasons).toContain("missing_execution_evidence");
  });

  it("solicitação de ajuste aberta não conclui o critério", () => {
    const result = evaluateCriterionCompletion({
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [
        action({
          status: "done",
          progressPercentage: 100,
          approved: true,
          hasOpenAdjustment: true,
        }),
      ],
    });
    expect(result.criterionCompleted).toBe(false);
    expect(result.blockReasons).toContain("open_supervision_request");
  });

  it("várias ações: uma pendente impede a conclusão do critério", () => {
    const result = evaluateCriterionCompletion({
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [
        action({ status: "done", progressPercentage: 100, approved: true }),
        action({ status: "done", progressPercentage: 100, approved: true }),
        action({ status: "doing", progressPercentage: 40 }),
      ],
    });
    expect(result.criterionCompleted).toBe(false);
    expect(result.activeActionCount).toBe(3);
    expect(result.completedActionCount).toBe(2);
  });

  it("ação cancelada não bloqueia a conclusão das demais", () => {
    const result = evaluateCriterionCompletion({
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [
        action({ status: "cancelled", progressPercentage: 10 }),
        action({ status: "done", progressPercentage: 100, approved: true }),
      ],
    });
    expect(result.criterionCompleted).toBe(true);
    expect(result.activeActionCount).toBe(1);
    expect(result.completedActionCount).toBe(1);
  });

  it("somente ações canceladas não concluem o critério", () => {
    const result = evaluateCriterionCompletion({
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [action({ status: "cancelled", progressPercentage: 0 })],
    });
    expect(result.criterionCompleted).toBe(false);
    expect(result.blockReasons).toContain("missing_active_action");
  });

  it("todas as condições válidas concluem o critério", () => {
    const result = evaluateCriterionCompletion({
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [
        action({
          status: "done",
          progressPercentage: 100,
          approved: true,
          hasRequiredEvidence: true,
        }),
      ],
    });
    expect(result.criterionCompleted).toBe(true);
    expect(result.blockReasons).toEqual([]);
  });
});
