import { describe, expect, it } from "vitest";
import type { RecommendationRowRaw } from "./types";
import {
  evaluateActionPlanCompletionReadiness,
  filterActionPlanCompletionReadiness,
} from "./completion-readiness";

function recommendation(id: string): RecommendationRowRaw {
  return {
    id,
    cycle_id: "cycle-1",
    period_label: "2026",
    cycle_state: "validated",
    axis_id: "axis-1",
    form_id: "form-1",
    organization_id: "org-1",
    recommendation_type: "nao_implementacao",
    current_text: `Recomendação ${id}`,
    status: "in_action_plan",
    question_id: `question-${id}`,
    questions: {
      id: `question-${id}`,
      prompt: `Critério ${id}`,
      section_id: "section-1",
      sections: {
        name: "Seção",
        axes: { id: "axis-1", name: "Governança" },
      },
    },
    action_plans: [
      {
        id: `plan-${id}`,
        action_text: `Executar ação ${id}`,
        due_date: "2026-12-31",
        responsible_label: "Setor · Responsável",
        status: "done",
        updated_at: "2026-07-24T00:00:00Z",
        revision: 2,
      },
    ],
    organizations: { id: "org-1", name: "Órgão" },
    forms: { id: "form-1", name: "Formulário", version: 1 },
  };
}

describe("prontidão da supervisão para encerramento", () => {
  it("permite ciclo sem bloqueios", () => {
    expect(evaluateActionPlanCompletionReadiness([], [])).toEqual({
      ready: true,
      pendingCount: 0,
      blocks: [],
      countsByReason: {
        exception_pending: 0,
        missing_active_action: 0,
        action_not_completed: 0,
        open_supervision_request: 0,
        missing_execution_evidence: 0,
        action_not_approved: 0,
      },
    });
  });

  it("enriquece todos os motivos retornados pelo banco", () => {
    const rows = [recommendation("rec-1")];
    const result = evaluateActionPlanCompletionReadiness(
      [
        { recommendation_id: "rec-1", action_plan_id: null, blocker: "exception_pending" },
        { recommendation_id: "rec-1", action_plan_id: null, blocker: "missing_active_action" },
        { recommendation_id: "rec-1", action_plan_id: "plan-rec-1", blocker: "action_not_completed" },
        { recommendation_id: "rec-1", action_plan_id: "plan-rec-1", blocker: "open_supervision_request" },
        { recommendation_id: "rec-1", action_plan_id: "plan-rec-1", blocker: "missing_execution_evidence" },
        { recommendation_id: "rec-1", action_plan_id: "plan-rec-1", blocker: "action_not_approved" },
      ],
      rows,
    );

    expect(result.ready).toBe(false);
    expect(result.pendingCount).toBe(6);
    expect(result.countsByReason).toEqual({
      exception_pending: 1,
      missing_active_action: 1,
      action_not_completed: 1,
      open_supervision_request: 1,
      missing_execution_evidence: 1,
      action_not_approved: 1,
    });
    expect(result.blocks[2]).toMatchObject({
      questionPrompt: "Critério rec-1",
      actionLabel: "Executar ação rec-1",
    });
  });

  it("mantém fallback seguro para dados já removidos", () => {
    const result = evaluateActionPlanCompletionReadiness(
      [{ recommendation_id: "removed", action_plan_id: null, blocker: "missing_active_action" }],
      [],
    );
    expect(result.blocks[0]).toMatchObject({
      questionPrompt: "Critério sem título",
      actionLabel: null,
    });
  });

  it("filtra os bloqueios para uma única recomendação sem recalcular a regra", () => {
    const full = evaluateActionPlanCompletionReadiness(
      [
        {
          recommendation_id: "rec-1",
          action_plan_id: "plan-rec-1",
          blocker: "action_not_completed",
        },
        {
          recommendation_id: "rec-2",
          action_plan_id: "plan-rec-2",
          blocker: "missing_execution_evidence",
        },
      ],
      [recommendation("rec-1"), recommendation("rec-2")],
    );

    const result = filterActionPlanCompletionReadiness(full, "rec-2");
    expect(result.pendingCount).toBe(1);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.reason).toBe("missing_execution_evidence");
    expect(result.countsByReason.missing_execution_evidence).toBe(1);
    expect(result.countsByReason.action_not_completed).toBe(0);
  });
});
