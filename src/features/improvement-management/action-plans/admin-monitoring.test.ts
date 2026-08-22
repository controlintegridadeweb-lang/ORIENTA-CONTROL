import { describe, expect, it } from "vitest";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import type { ActionPlanListItem } from "./types";
import {
  derivePlanView,
  deriveRiskScore,
  groupByOrganization,
  progressFromAction,
  riskLevelFromScore,
  summarize,
  toAdminPlanItem,
} from "./admin-monitoring";
import { computeActionSla } from "@/features/improvement-management/action-plans/domain-model";

const NOW = new Date("2025-06-15T12:00:00.000Z");

function makeRow(over: Partial<ActionPlanListItem> = {}): ActionPlanListItem {
  const base: ActionPlanListItem = {
    recommendationId: "rec-1",
    questionId: "q-1",
    cycleState: "completed",
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
    updatedAt: "2025-06-10T10:00:00Z",
    revision: 1,
    documents: [],
    ...over,
  };
  return { ...base, slaLabel: computeActionSla(base) };
}

describe("derivePlanView", () => {
  it("sem plano vira not_started", () => {
    expect(derivePlanView(makeRow(), NOW)).toBe("not_started");
  });
  it("plano completed mantém completed", () => {
    expect(
      derivePlanView(
        makeRow({ plans: [makePlan({ status: "completed", progressPercentage: 100 })] }),
        NOW,
      ),
    ).toBe("completed");
  });
  it("SLA overdue força overdue", () => {
    expect(
      derivePlanView(
        makeRow({
          plans: [makePlan({ status: "in_progress", progressPercentage: 50 })],
          slaLabel: "overdue",
        }),
        NOW,
      ),
    ).toBe("overdue");
  });
  it("atraso é derivado do SLA, não gravado no plano", () => {
    expect(
      derivePlanView(
        makeRow({
          plans: [makePlan({ status: "not_started", progressPercentage: 0 })],
          slaLabel: "overdue",
        }),
        NOW,
      ),
    ).toBe("overdue");
  });
});

describe("progressFromAction", () => {
  it("lê progressPercentage persistido", () => {
    expect(progressFromAction(null)).toBe(0);
    expect(progressFromAction(undefined)).toBe(0);
    expect(progressFromAction({ progressPercentage: 0 })).toBe(0);
    expect(progressFromAction({ progressPercentage: 42 })).toBe(42);
    expect(progressFromAction({ progressPercentage: 100 })).toBe(100);
  });
});

describe("deriveRiskScore", () => {
  it("plano completed tem score zero", () => {
    expect(
      deriveRiskScore(
        makeRow({ plans: [makePlan({ status: "completed", progressPercentage: 100 })] }),
        NOW,
      ),
    ).toBe(0);
  });
});

describe("riskLevelFromScore", () => {
  it("respeita limiares", () => {
    expect(riskLevelFromScore(60, true, false)).toBe("high");
    expect(riskLevelFromScore(45, true, false)).toBe("medium");
    expect(riskLevelFromScore(99, true, true)).toBe("healthy");
    expect(riskLevelFromScore(0, false, false)).toBe("medium");
  });
});

describe("summarize", () => {
  it("agrega contadores", () => {
    const items = [
      toAdminPlanItem(makeRow(), NOW),
      toAdminPlanItem(
        makeRow({
          plans: [makePlan({ status: "in_progress", progressPercentage: 50, updatedAt: "2025-06-14T10:00:00Z" })],
        }),
        NOW,
      ),
      toAdminPlanItem(
        makeRow({ plans: [makePlan({ status: "completed", progressPercentage: 100 })] }),
        NOW,
      ),
      toAdminPlanItem(
        makeRow({
          plans: [makePlan({ status: "not_started", progressPercentage: 0, responsibleName: "" })],
          slaLabel: "overdue",
        }),
        NOW,
      ),
    ];
    const s = summarize(items);
    expect(s.total).toBe(4);
    expect(s.inProgress).toBeGreaterThanOrEqual(1);
    expect(s.completed).toBe(1);
    expect(s.overdue).toBeGreaterThanOrEqual(1);
  });

  it("não conta ação cancelada como concluída por causa do estado da recomendação", () => {
    const item = toAdminPlanItem(
      makeRow({
        recommendationStatus: "completed",
        plans: [makePlan({ status: "cancelled", progressPercentage: 0 })],
      }),
      NOW,
    );
    expect(summarize([item]).completed).toBe(0);
    expect(groupByOrganization([item])[0]?.completed).toBe(0);
  });
});

describe("groupByOrganization", () => {
  it("agrega por organizacao", () => {
    const items = [
      toAdminPlanItem(makeRow({ organizationId: "a", organizationName: "Alfa" }), NOW),
      toAdminPlanItem(
        makeRow({
          organizationId: "b",
          organizationName: "Beta",
          plans: [makePlan({ status: "not_started", progressPercentage: 0, responsibleName: "" })],
          slaLabel: "overdue",
        }),
        NOW,
      ),
    ];
    const groups = groupByOrganization(items);
    expect(groups.length).toBe(2);
    expect(groups[0]?.highRisk).toBeGreaterThanOrEqual(0);
  });
});

describe("toAdminPlanItem com recomendação expandida", () => {
  it("preserva a quantidade total de ações da recomendação", () => {
    const item = toAdminPlanItem(
      makeRow({
        plans: [makePlan({ progressPercentage: 0 })],
        recommendationActionCount: 3,
      }),
      NOW,
    );
    expect(item.totalActionsForRecommendation).toBe(3);
    expect(item.startDate).toBe("2099-01-01");
    expect(item.sectionOrder).toBe(1);
    expect(item.questionOrder).toBe(1);
  });
});
