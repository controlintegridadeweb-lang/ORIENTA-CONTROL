import { describe, expect, it } from "vitest";
import {
  calculatePreliminaryCriterion,
  calculatePreliminaryCriterionV2,
} from "./domain";
import { FAMI_PRELIMINARY_METHODOLOGY_V1, FAMI_PRELIMINARY_METHODOLOGY_V2 } from "./methodology";
import type { ActionCompletionSnapshot } from "@/shared/domain/criterion-completion";

function doneApproved(overrides: Partial<ActionCompletionSnapshot> = {}): ActionCompletionSnapshot {
  return {
    status: "done",
    progressPercentage: 100,
    approved: true,
    hasOpenAdjustment: false,
    hasRequiredEvidence: true,
    requiresEvidence: false,
    ...overrides,
  };
}

describe("FAMI preliminar — prelim_v2", () => {
  it("progresso 0% não recupera", () => {
    const result = calculatePreliminaryCriterionV2({
      officialPoints: 0,
      pointsPossible: 2,
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [
        {
          status: "todo",
          progressPercentage: 0,
          approved: false,
          hasOpenAdjustment: false,
          hasRequiredEvidence: false,
        },
      ],
      activeActionProgressPercentages: [0],
    });
    expect(result.preliminaryPoints).toBe(0);
    expect(result.recoveredPoints).toBe(0);
    expect(result.criterionCompleted).toBe(false);
    expect(result.methodologyVersion).toBe(FAMI_PRELIMINARY_METHODOLOGY_V2);
  });

  it("progresso 50% não recupera", () => {
    const result = calculatePreliminaryCriterionV2({
      officialPoints: 0,
      pointsPossible: 2,
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [
        {
          status: "doing",
          progressPercentage: 50,
          approved: false,
          hasOpenAdjustment: false,
          hasRequiredEvidence: false,
        },
      ],
      activeActionProgressPercentages: [50],
    });
    expect(result.preliminaryPoints).toBe(0);
    expect(result.actionProgressPercentage).toBe(50);
  });

  it("progresso 99% não recupera", () => {
    const result = calculatePreliminaryCriterionV2({
      officialPoints: 1,
      pointsPossible: 2,
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [
        {
          status: "doing",
          progressPercentage: 99,
          approved: false,
          hasOpenAdjustment: false,
          hasRequiredEvidence: false,
        },
      ],
      activeActionProgressPercentages: [99],
    });
    expect(result.preliminaryPoints).toBe(1);
    expect(result.recoveredPoints).toBe(0);
  });

  it("100% sem aceite não recupera", () => {
    const result = calculatePreliminaryCriterionV2({
      officialPoints: 0,
      pointsPossible: 1,
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [doneApproved({ approved: false })],
    });
    expect(result.preliminaryPoints).toBe(0);
  });

  it("concluído sem comprovação necessária não recupera", () => {
    const result = calculatePreliminaryCriterionV2({
      officialPoints: 0,
      pointsPossible: 2,
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [doneApproved({ requiresEvidence: true, hasRequiredEvidence: false })],
    });
    expect(result.preliminaryPoints).toBe(0);
  });

  it("solicitação de ajuste aberta não recupera", () => {
    const result = calculatePreliminaryCriterionV2({
      officialPoints: 0,
      pointsPossible: 2,
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [doneApproved({ hasOpenAdjustment: true })],
    });
    expect(result.preliminaryPoints).toBe(0);
  });

  it("todas as condições válidas recuperam integralmente o gap", () => {
    expect(
      calculatePreliminaryCriterionV2({
        officialPoints: 0,
        pointsPossible: 2,
        hasRecommendation: true,
        hasApprovedException: false,
        actions: [doneApproved()],
      }).preliminaryPoints,
    ).toBe(2);
    expect(
      calculatePreliminaryCriterionV2({
        officialPoints: 1,
        pointsPossible: 2,
        hasRecommendation: true,
        hasApprovedException: false,
        actions: [doneApproved()],
      }).preliminaryPoints,
    ).toBe(2);
    expect(
      calculatePreliminaryCriterionV2({
        officialPoints: 0,
        pointsPossible: 1,
        hasRecommendation: true,
        hasApprovedException: false,
        actions: [doneApproved()],
      }).preliminaryPoints,
    ).toBe(1);
  });

  it("várias ações: uma pendente impede a conclusão do critério", () => {
    const result = calculatePreliminaryCriterionV2({
      officialPoints: 0,
      pointsPossible: 2,
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [
        doneApproved(),
        doneApproved(),
        {
          status: "doing",
          progressPercentage: 90,
          approved: false,
          hasOpenAdjustment: false,
          hasRequiredEvidence: false,
        },
      ],
    });
    expect(result.criterionCompleted).toBe(false);
    expect(result.preliminaryPoints).toBe(0);
    expect(result.completedActionCount).toBe(2);
    expect(result.activeActionCount).toBe(3);
  });

  it("ação cancelada segue a regra vigente e não bloqueia", () => {
    const result = calculatePreliminaryCriterionV2({
      officialPoints: 0,
      pointsPossible: 2,
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [
        {
          status: "cancelled",
          progressPercentage: 0,
          approved: false,
          hasOpenAdjustment: false,
          hasRequiredEvidence: false,
        },
        doneApproved(),
      ],
    });
    expect(result.criterionCompleted).toBe(true);
    expect(result.preliminaryPoints).toBe(2);
    expect(result.activeActionCount).toBe(1);
  });

  it("resultado nunca ultrapassa points_possible", () => {
    const result = calculatePreliminaryCriterionV2({
      officialPoints: 2,
      pointsPossible: 2,
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [doneApproved()],
    });
    expect(result.preliminaryPoints).toBe(2);
    expect(result.recoveredPoints).toBe(0);
  });

  it("prelim_v1 continua funcionando sem alteração retroativa", () => {
    const v1 = calculatePreliminaryCriterion({
      officialPoints: 0,
      pointsPossible: 2,
      activeActionProgressPercentages: [50, 100],
      hasApprovedException: false,
      hasRecommendation: true,
    });
    expect(v1).toEqual({
      officialPoints: 0,
      pointsPossible: 2,
      recoverableGap: 2,
      activeActionCount: 2,
      actionProgressPercentage: 75,
      recoveredPoints: 1.5,
      preliminaryPoints: 1.5,
    });
    expect(FAMI_PRELIMINARY_METHODOLOGY_V1).toBe("prelim_v1");
  });

  it("prelim_v2 usa a nova regra e ignora o percentual na pontuação", () => {
    const v2 = calculatePreliminaryCriterionV2({
      officialPoints: 0,
      pointsPossible: 2,
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [
        {
          status: "doing",
          progressPercentage: 90,
          approved: false,
          hasOpenAdjustment: false,
          hasRequiredEvidence: false,
        },
      ],
      activeActionProgressPercentages: [90],
    });
    expect(v2.actionProgressPercentage).toBe(90);
    expect(v2.preliminaryPoints).toBe(0);
    expect(v2.methodologyVersion).toBe("prelim_v2");
  });

  it("aceite posterior ao corte não pontua no snapshot da data de corte", () => {
    const atCutoff = calculatePreliminaryCriterionV2({
      officialPoints: 0,
      pointsPossible: 2,
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [doneApproved({ approved: false })],
    });
    const afterCutoff = calculatePreliminaryCriterionV2({
      officialPoints: 0,
      pointsPossible: 2,
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [doneApproved({ approved: true })],
    });
    expect(atCutoff.preliminaryPoints).toBe(0);
    expect(afterCutoff.preliminaryPoints).toBe(2);
  });

  it("revisão posterior altera só o recálculo corrente, não o snapshot já avaliado", () => {
    const closedSnapshot = calculatePreliminaryCriterionV2({
      officialPoints: 0,
      pointsPossible: 2,
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [doneApproved()],
    });
    const laterRevision = calculatePreliminaryCriterionV2({
      officialPoints: 0,
      pointsPossible: 2,
      hasRecommendation: true,
      hasApprovedException: false,
      actions: [doneApproved({ approved: false })],
    });
    expect(closedSnapshot.preliminaryPoints).toBe(2);
    expect(laterRevision.preliminaryPoints).toBe(0);
  });
});
