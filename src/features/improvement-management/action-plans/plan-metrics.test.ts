import { describe, expect, it } from "vitest";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { computeActionPlanMetrics } from "./plan-metrics";

function plan(
  over: Partial<ActionPlanAction> & Pick<ActionPlanAction, "progressPercentage" | "status">,
): ActionPlanAction {
  return {
    id: over.id ?? `plan-${over.progressPercentage}-${over.status}`,
    actionText: "Ação",
    startDate: over.startDate ?? "2099-08-01",
    dueDate: over.dueDate ?? "2099-08-20",
    responsibleSector: "TI",
    responsibleUserId: "55555555-5555-4555-8555-555555555555",
    responsibleName: over.responsibleName ?? "Responsável",
    progressPercentage: over.progressPercentage,
    status: over.status,
    observations: null,
    updatedAt: "2026-01-01T00:00:00Z",
    revision: over.revision ?? 1,
    documents: over.documents ?? [],
    slaLabel: over.slaLabel ?? "ok",
  };
}

describe("computeActionPlanMetrics", () => {
  it("retorna zeros sem ações", () => {
    expect(computeActionPlanMetrics([])).toEqual({
      total: 0,
      active: 0,
      notStarted: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      overdue: 0,
      noResp: 0,
      progress: 0,
    });
  });

  it("calcula média de progresso, inProgress e exclui canceladas dos ativos", () => {
    const metrics = computeActionPlanMetrics([
      plan({ progressPercentage: 60, status: "in_progress" }),
      plan({ progressPercentage: 0, status: "not_started" }),
      plan({ progressPercentage: 100, status: "cancelled" }),
    ]);
    expect(metrics.total).toBe(3);
    expect(metrics.active).toBe(2);
    expect(metrics.notStarted).toBe(1);
    expect(metrics.inProgress).toBe(1);
    expect(metrics.completed).toBe(0);
    expect(metrics.cancelled).toBe(1);
    expect(metrics.progress).toBe(30);
  });

  it("conta atrasadas apenas entre ações ativas", () => {
    const metrics = computeActionPlanMetrics([
      plan({
        progressPercentage: 50,
        status: "in_progress",
        dueDate: "2020-01-01",
        slaLabel: "overdue",
      }),
      plan({
        progressPercentage: 100,
        status: "completed",
        dueDate: "2020-01-01",
        slaLabel: "na",
      }),
    ]);
    expect(metrics.overdue).toBe(1);
    expect(metrics.completed).toBe(1);
    expect(metrics.active).toBe(2);
    expect(metrics.inProgress).toBe(1);
  });

  it("conta ações sem responsável", () => {
    const metrics = computeActionPlanMetrics([
      plan({ progressPercentage: 0, status: "not_started", responsibleName: "   " }),
      plan({ progressPercentage: 40, status: "in_progress", responsibleName: "Ana" }),
    ]);
    expect(metrics.noResp).toBe(1);
    expect(metrics.inProgress).toBe(1);
  });
});
