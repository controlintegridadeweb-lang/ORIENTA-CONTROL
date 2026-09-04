import { describe, expect, it } from "vitest";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { monitoringActionBars, monitoringSituationSlices } from "./monitoring-chart-model";

function action(over: Partial<ActionPlanAction> = {}): ActionPlanAction {
  return {
    id: "plan-1",
    actionText: "Publicar informações",
    startDate: "2026-04-01",
    dueDate: "2026-09-30",
    responsibleSector: "UCI",
    responsibleUserId: null,
    responsibleName: "Unidade X",
    progressPercentage: 40,
    status: "in_progress",
    observations: null,
    updatedAt: "2026-08-12T12:00:00.000Z",
    revision: 1,
    documents: [],
    slaLabel: "ok",
    ...over,
  };
}

describe("monitoringSituationSlices", () => {
  it("não conta a mesma ação em atraso e em andamento", () => {
    const slices = monitoringSituationSlices([
      action({ id: "a", slaLabel: "overdue", progressPercentage: 40, status: "in_progress" }),
      action({ id: "b", progressPercentage: 100, status: "completed" }),
      action({ id: "c", progressPercentage: 0, status: "not_started" }),
    ]);
    const byKey = Object.fromEntries(slices.map((slice) => [slice.key, slice.value]));
    expect(byKey).toMatchObject({
      overdue: 1,
      completed: 1,
      not_started: 1,
      in_progress: 0,
    });
  });
});

describe("monitoringActionBars", () => {
  it("preserva o rótulo e o percentual de cada ação", () => {
    expect(
      monitoringActionBars([
        { action: action({ id: "a", progressPercentage: 40 }), label: "A1" },
        { action: action({ id: "b", progressPercentage: 100, status: "completed" }), label: "A2" },
      ]),
    ).toEqual([
      expect.objectContaining({ id: "a", label: "A1", progress: 40 }),
      expect.objectContaining({ id: "b", label: "A2", progress: 100 }),
    ]);
  });
});
