import { describe, expect, it } from "vitest";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import type { ActionPlanListItem } from "@/features/improvement-management/action-plans/types";
import {
  groupByOrganization,
  groupByStatus,
  summarize,
  toAdminItem,
} from "./admin-presentation";
import { computeActionSla } from "@/features/improvement-management/action-plans/domain-model";

function makeRow(over: Partial<ActionPlanListItem> = {}): ActionPlanListItem {
  const base: ActionPlanListItem = {
    recommendationId: "rec-1",
    questionId: "q-1",
    cycleState: "validated",
    formId: "form-1",
    formName: "Form 1",
    formVersion: 1,
    organizationId: "org-1",
    organizationName: "Org 1",
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

function makePlan(over: Partial<Omit<ActionPlanAction, "slaLabel">> = {}): ActionPlanAction {
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
    updatedAt: "2025-01-01",
    revision: 1,
    documents: [],
    ...over,
  };
  return { ...base, slaLabel: computeActionSla(base) };
}

describe("summarize (admin)", () => {
  it("agrega KPIs oficiais", () => {
    const items = [
      toAdminItem(makeRow()),
      toAdminItem(makeRow({ plans: [makePlan()], recommendationStatus: "in_action_plan" })),
      toAdminItem(
        makeRow({
          plans: [makePlan({ status: "in_progress", progressPercentage: 50 })],
          recommendationStatus: "in_action_plan",
        }),
      ),
      toAdminItem(
        makeRow({
          plans: [makePlan({ status: "in_progress", progressPercentage: 50 })],
          recommendationStatus: "in_action_plan",
          slaLabel: "overdue",
        }),
      ),
      toAdminItem(
        makeRow({
          plans: [makePlan({ status: "completed", progressPercentage: 100 })],
          recommendationStatus: "completed",
        }),
      ),
      toAdminItem(makeRow({ recommendationStatus: "exception_requested" })),
      toAdminItem(makeRow({ recommendationStatus: "dismissed" })),
    ];
    const s = summarize(items);
    expect(s.total).toBe(7);
    expect(s.withoutPlan).toBe(1);
    expect(s.withPlan).toBe(4);
    expect(s.inExecution).toBe(4);
    expect(s.overdue).toBe(1);
    expect(s.completed).toBe(1);
  });
});

describe("groupByOrganization", () => {
  it("agrupa e ordena org com mais atrasadas primeiro", () => {
    const items = [
      toAdminItem(makeRow({ organizationId: "a", organizationName: "Alfa" })),
      toAdminItem(
        makeRow({
          organizationId: "b",
          organizationName: "Beta",
          plans: [makePlan({ status: "in_progress", progressPercentage: 50 })],
          slaLabel: "overdue",
        }),
      ),
    ];
    const groups = groupByOrganization(items);
    expect(groups[0]?.organizationId).toBe("b");
    expect(groups[0]?.overdue).toBe(1);
  });
});

describe("groupByStatus", () => {
  it("agrupa por recommendationStatus", () => {
    const items = [
      toAdminItem(makeRow({ recommendationStatus: "generated" })),
      toAdminItem(makeRow({ recommendationStatus: "completed" })),
    ];
    const groups = groupByStatus(items);
    expect(groups.some((g) => g.status === "generated")).toBe(true);
    expect(groups.some((g) => g.status === "completed")).toBe(true);
  });
});
