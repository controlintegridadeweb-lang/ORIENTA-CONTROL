import { describe, expect, it } from "vitest";
import { STRUCTURAL_AXIS_ORDER } from "@/shared/domain/axis";
import type { ActionPlanByCyclePayload, RecommendationWithPlansRow } from "./domain-model";
import {
  aggregateSlaFromActions,
  buildActionPlanByCyclePayload,
  computeActionSla,
} from "./domain-model";

function makeRecommendationRow(
  over: Partial<RecommendationWithPlansRow> = {},
): RecommendationWithPlansRow {
  const id = over.id ?? "rec-1";
  return {
    id,
    form_id: over.form_id ?? "form-1",
    organization_id: over.organization_id ?? "org-1",
    recommendation_type: over.recommendation_type ?? "risk",
    current_text: over.current_text ?? "Texto recomendação",
    status: over.status ?? "generated",
    question_id: over.question_id ?? "q-1",
    questions: over.questions ?? {
      prompt: "Pergunta",
      sections: { name: "Seção Gov", axes: { id: "ax-gov", name: "Governanca" } },
    },
    action_plans: over.action_plans ?? [],
    ...over,
  };
}

describe("computeActionSla / aggregateSlaFromActions", () => {
  it(" marca overdue antes do dia de hoje", () => {
    expect(
      computeActionSla({
        dueDate: "2000-01-01",
        status: "in_progress",
      }),
    ).toBe("overdue");
  });
  it("completed ignora SLA", () => {
    expect(
      computeActionSla({
        dueDate: "2000-01-01",
        status: "completed",
      }),
    ).toBe("na");
  });
  it("prazo distante marca ok", () => {
    expect(
      computeActionSla({
        dueDate: "2099-12-31",
        status: "not_started",
      }),
    ).toBe("ok");
  });
  it("usa o dia de Fortaleza na virada UTC", () => {
    const atLocal2130 = new Date("2026-07-12T00:30:00.000Z");

    expect(
      computeActionSla(
        { dueDate: "2026-07-11", status: "in_progress" },
        atLocal2130,
      ),
    ).toBe("due_soon");
    expect(
      computeActionSla(
        { dueDate: "2026-07-10", status: "in_progress" },
        atLocal2130,
      ),
    ).toBe("overdue");
  });
  it("aggregate: overdue tem precedência", () => {
    expect(
      aggregateSlaFromActions([
        { slaLabel: "ok" },
        { slaLabel: "overdue" },
        { slaLabel: "due_soon" },
      ]),
    ).toBe("overdue");
  });
});

describe("buildActionPlanByCyclePayload", () => {
  it("ordena eixos Governanca → Ambiental → Social e agrupa recs por eixo", () => {
    const recommendationRows = [
      makeRecommendationRow({
        id: "r-soc",
        question_id: "q-soc",
        current_text: "Social rec",
        questions: {
          prompt: "Qs",
          sections: { name: "Ssoc", axes: { id: "ax-soc", name: "Social" } },
        },
      }),
      makeRecommendationRow({
        id: "r-gov",
        question_id: "q-gov",
        current_text: "Gov rec",
        questions: {
          prompt: "Qg",
          sections: { name: "Sgov", axes: { id: "ax-gov", name: "Governanca" } },
        },
      }),
      makeRecommendationRow({
        id: "r-amb",
        question_id: "q-amb",
        current_text: "Amb rec",
        questions: {
          prompt: "Qa",
          sections: { name: "Samb", axes: { id: "ax-amb", name: "Ambiental" } },
        },
      }),
    ];

    const payload: ActionPlanByCyclePayload = buildActionPlanByCyclePayload({
      cycleId: "cycle-1",
      formId: "form-1",
      formName: "F",
      formVersion: 2,
      organizationId: "org-1",
      organizationName: "O",
      recommendationRows,
    });

    expect(payload.axes.map((a) => a.axisName)).toEqual([
      STRUCTURAL_AXIS_ORDER[0],
      STRUCTURAL_AXIS_ORDER[1],
      STRUCTURAL_AXIS_ORDER[2],
    ]);
    expect(payload.axes[0]!.axisId).toBe("ax-gov");
    expect(payload.summary.totalRecommendations).toBe(3);
    expect(payload.summary.totalActions).toBe(0);
  });

  it("conta acoes por status", () => {
    const recommendationRows = [
      makeRecommendationRow({
        action_plans: [
          {
            id: "p1",
            action_text: "A1",
            due_date: "2099-01-01",
            responsible_sector: "S",
            responsible_name: "N",
            status: "doing",
            progress_percentage: 50,
            observations: null,
            updated_at: "2026-01-02T10:00:00Z",
          },
          {
            id: "p2",
            action_text: "A2",
            due_date: "2099-01-02",
            responsible_sector: "S",
            responsible_name: "N",
            status: "done",
            progress_percentage: 100,
            observations: null,
            updated_at: "2026-01-03T10:00:00Z",
          },
        ],
      }),
    ];
    const payload = buildActionPlanByCyclePayload({
      cycleId: "cycle-1",
      formId: "form-1",
      formName: "F",
      formVersion: 1,
      organizationId: "org-1",
      organizationName: "O",
      recommendationRows,
    });
    expect(payload.summary.totalActions).toBe(2);
    expect(payload.summary.recommendationsWithActions).toBe(1);
    expect(payload.summary.actionsByStatus.in_progress).toBe(1);
    expect(payload.summary.actionsByStatus.completed).toBe(1);
    const recNode = payload.axes[0]!.recommendations[0]!;
    expect(recNode.actions).toHaveLength(2);
    expect(recNode.actions[0]!.updatedAt).toBe("2026-01-03T10:00:00Z"); // ordenado por updated_at desc
  });

  it("ordena recomendacoes alfabéticas dentro do mesmo eixo", () => {
    const recommendationRows = [
      makeRecommendationRow({ id: "r-b", question_id: "q-b", current_text: "Bbb" }),
      makeRecommendationRow({ id: "r-a", question_id: "q-a", current_text: "Aaa" }),
    ];
    const payload = buildActionPlanByCyclePayload({
      cycleId: "cycle-1",
      formId: "form-1",
      formName: "F",
      formVersion: 1,
      organizationId: "org-1",
      organizationName: "O",
      recommendationRows,
    });
    expect(payload.axes[0]!.recommendations.map((r) => r.recommendationId)).toEqual(["r-a", "r-b"]);
  });
});
