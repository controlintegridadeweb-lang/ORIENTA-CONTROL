import { describe, expect, it } from "vitest";
import {
  progressFromPlan,
  summarize,
  toRespondentItem,
} from "./respondent-presentation";
import type { ActionPlanListItem } from "@/features/improvement-management/action-plans/types";
import { computeActionSla } from "@/features/improvement-management/action-plans/domain-model";

function baseRow(over: Partial<ActionPlanListItem> = {}): ActionPlanListItem {
  const base: ActionPlanListItem = {
    recommendationId: "rec-1",
    questionId: "q-1",
    cycleState: "validated",
    formId: "form-1",
    formName: "Form 1",
    formVersion: 1,
    organizationId: "org-1",
    organizationName: "Org",
    questionPrompt: "Q",
    sectionId: "section-1",
    sectionName: "S",
    sectionOrder: 1,
    questionOrder: 1,
    axisName: "A",
    recommendationType: "type",
    recommendationText: "texto",
    recommendationStatus: "generated",
    plans: [],
    slaLabel: "na",
  };
  return { ...base, ...over };
}

function makePlan(
  over: Partial<Parameters<typeof computeActionSla>[0]> & { id?: string; progressPercentage?: number },
) {
  const base = {
    id: "plan-1",
    actionText: "ação",
    startDate: "2099-01-01",
    dueDate: "2099-01-01",
    responsibleSector: "TI",
    responsibleUserId: "55555555-5555-4555-8555-555555555555",
    responsibleName: "Alice",
    progressPercentage: over.progressPercentage ?? 0,
    status: "not_started" as const,
    observations: null,
    updatedAt: "2025-06-10T10:00:00Z",
    revision: 1,
    documents: [],
    ...over,
  };
  return { ...base, slaLabel: computeActionSla(base) };
}

describe("progressFromPlan", () => {
  it("lê progressPercentage da ação (null → 0)", () => {
    expect(progressFromPlan(null)).toBe(0);
    expect(progressFromPlan({ progressPercentage: 0 })).toBe(0);
    expect(progressFromPlan({ progressPercentage: 55 })).toBe(55);
    expect(progressFromPlan({ progressPercentage: 100 })).toBe(100);
  });
});

describe("toRespondentItem", () => {
  it("marca needsAction para generated sem plano", () => {
    const item = toRespondentItem(baseRow());
    expect(item.status).toBe("generated");
    expect(item.needsAction).toBe(true);
    expect(item.hasPlan).toBe(false);
    expect(item.organizationName).toBe("Org");
    expect(item.plans).toEqual([]);
  });

  it("marca needsAction para plano em execução", () => {
    const item = toRespondentItem(
      baseRow({
        recommendationStatus: "in_action_plan",
        plans: [makePlan({ status: "in_progress", progressPercentage: 50 })],
      }),
    );
    expect(item.needsAction).toBe(true);
    expect(item.hasPlan).toBe(true);
  });

  it("não libera ações nem pendência operacional antes da consolidação", () => {
    const item = toRespondentItem(baseRow({ cycleState: "submitted" }));
    expect(item.canCreateActionPlan).toBe(false);
    expect(item.needsAction).toBe(false);
  });
});

describe("summarize", () => {
  it("conta buckets oficiais", () => {
    const items = [
      toRespondentItem(baseRow({ recommendationStatus: "generated" })),
      toRespondentItem(baseRow({ recommendationStatus: "in_action_plan" })),
      toRespondentItem(baseRow({ recommendationStatus: "completed" })),
      toRespondentItem(baseRow({ recommendationStatus: "exception_requested" })),
      toRespondentItem(baseRow({ recommendationStatus: "adjustment_requested" })),
    ];
    const s = summarize(items);
    expect(s.total).toBe(5);
    expect(s.awaitingAction).toBe(1);
    expect(s.inProgress).toBe(1);
    expect(s.resolved).toBe(1);
  });
});
