import { describe, expect, it } from "vitest";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import {
  calculatePlanProgress,
  deriveActionStatus,
  progressFromPlan,
  progressFromPlans,
  assertProgressDoesNotDecrease,
  progressCannotDecreaseMessage,
  PROGRESS_PERCENTAGE_CANNOT_DECREASE,
} from "./plan-progress";

function action(
  over: Partial<ActionPlanAction> & Pick<ActionPlanAction, "progressPercentage" | "status">,
): ActionPlanAction {
  return {
    id: over.id ?? `plan-${over.progressPercentage}-${over.status}`,
    actionText: "Ação",
    startDate: over.startDate ?? "2026-08-01",
    dueDate: over.dueDate ?? "2026-08-20",
    responsibleSector: "TI",
    responsibleUserId: "55555555-5555-4555-8555-555555555555",
    responsibleName: "Responsável",
    progressPercentage: over.progressPercentage,
    status: over.status,
    observations: null,
    updatedAt: "2026-01-01T00:00:00Z",
    revision: 1,
    documents: [],
    slaLabel: "ok",
  };
}

describe("deriveActionStatus", () => {
  it("deriva situação a partir do percentual informado", () => {
    expect(deriveActionStatus(0, false)).toBe("not_started");
    expect(deriveActionStatus(1, false)).toBe("in_progress");
    expect(deriveActionStatus(99, false)).toBe("in_progress");
    expect(deriveActionStatus(100, false)).toBe("completed");
  });

  it("cancelamento é excepcional e não depende do percentual", () => {
    expect(deriveActionStatus(0, true)).toBe("cancelled");
    expect(deriveActionStatus(50, true)).toBe("cancelled");
    expect(deriveActionStatus(100, true)).toBe("cancelled");
  });

  it("rejeita percentuais inconsistentes", () => {
    expect(() => deriveActionStatus(50.5, false)).toThrow("progress_percentage_must_be_integer");
    expect(() => deriveActionStatus(-1, false)).toThrow("progress_percentage_out_of_range");
    expect(() => deriveActionStatus(101, false)).toThrow("progress_percentage_out_of_range");
  });
});

describe("assertProgressDoesNotDecrease", () => {
  it("aceita avançar ou manter o percentual já registrado", () => {
    expect(assertProgressDoesNotDecrease(20, 20)).toBe(20);
    expect(assertProgressDoesNotDecrease(20, 55)).toBe(55);
    expect(assertProgressDoesNotDecrease(0, 1)).toBe(1);
    expect(assertProgressDoesNotDecrease(99, 100)).toBe(100);
  });

  it("recusa redução do percentual já registrado", () => {
    expect(() => assertProgressDoesNotDecrease(20, 19)).toThrow(
      PROGRESS_PERCENTAGE_CANNOT_DECREASE,
    );
    expect(() => assertProgressDoesNotDecrease(100, 99)).toThrow(
      PROGRESS_PERCENTAGE_CANNOT_DECREASE,
    );
    expect(progressCannotDecreaseMessage(20)).toBe(
      "O progresso da ação não pode ser reduzido. O percentual atual é 20%.",
    );
  });
});

describe("progressFromPlan", () => {
  it("lê progressPercentage da ação (null → 0)", () => {
    expect(progressFromPlan(null)).toBe(0);
    expect(progressFromPlan({ progressPercentage: 0 })).toBe(0);
    expect(progressFromPlan({ progressPercentage: 42 })).toBe(42);
    expect(progressFromPlan({ progressPercentage: 100 })).toBe(100);
  });
});

describe("calculatePlanProgress / progressFromPlans", () => {
  it("retorna 0 sem ações", () => {
    expect(calculatePlanProgress([])).toBe(0);
    expect(progressFromPlans([])).toBe(0);
  });

  it("calcula a média dos percentuais das ações ativas", () => {
    expect(
      calculatePlanProgress([
        action({ progressPercentage: 60, status: "in_progress" }),
        action({ progressPercentage: 0, status: "not_started" }),
      ]),
    ).toBe(30);
    expect(
      progressFromPlans([
        action({ progressPercentage: 60, status: "in_progress" }),
        action({ progressPercentage: 0, status: "not_started" }),
      ]),
    ).toBe(30);
  });

  it("inclui 0% no cálculo da média", () => {
    expect(
      calculatePlanProgress([
        action({ progressPercentage: 100, status: "completed" }),
        action({ progressPercentage: 0, status: "not_started" }),
      ]),
    ).toBe(50);
  });

  it("exclui canceladas da média", () => {
    expect(
      calculatePlanProgress([
        action({ progressPercentage: 100, status: "completed" }),
        action({ progressPercentage: 80, status: "cancelled" }),
        action({ progressPercentage: 20, status: "in_progress" }),
      ]),
    ).toBe(60);
  });

  it("retorna 0 quando só há canceladas", () => {
    expect(
      calculatePlanProgress([
        action({ progressPercentage: 50, status: "cancelled" }),
        action({ progressPercentage: 100, status: "cancelled" }),
      ]),
    ).toBe(0);
  });

  it("retorna 100 quando todas as ativas estão concluídas", () => {
    expect(
      calculatePlanProgress([
        action({ progressPercentage: 100, status: "completed" }),
        action({ progressPercentage: 100, status: "completed" }),
      ]),
    ).toBe(100);
  });
});
