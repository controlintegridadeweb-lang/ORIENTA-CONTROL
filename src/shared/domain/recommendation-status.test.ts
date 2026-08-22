import { describe, expect, it } from "vitest";
import { deriveRecommendationStatus } from "./recommendation-status";

describe("deriveRecommendationStatus — seção 6.7", () => {
  it("sem ações → generated", () => {
    expect(deriveRecommendationStatus([], false)).toBe("generated");
  });

  it("waiver → dismissed", () => {
    expect(deriveRecommendationStatus([{ status: "todo" }], true)).toBe("dismissed");
  });

  it("ação todo/doing → in_action_plan", () => {
    expect(deriveRecommendationStatus([{ status: "todo" }], false)).toBe("in_action_plan");
    expect(deriveRecommendationStatus([{ status: "doing" }], false)).toBe("in_action_plan");
  });

  it("execução concluída sem aceite → awaiting_approval", () => {
    expect(deriveRecommendationStatus([{ status: "done" }], false)).toBe("awaiting_approval");
  });

  it("execução concluída com aceite vigente → completed", () => {
    expect(deriveRecommendationStatus(
      [{ status: "done" }],
      false,
      { allCompletedActionsApproved: true },
    )).toBe("completed");
  });

  it("todas cancelled sem done → generated", () => {
    expect(deriveRecommendationStatus([{ status: "cancelled" }], false)).toBe("generated");
  });

  it("mistura done e cancelled aguarda aceite da ação executada", () => {
    expect(
      deriveRecommendationStatus(
        [{ status: "done" }, { status: "cancelled" }],
        false,
      ),
    ).toBe("awaiting_approval");
  });

  it("prioriza ajuste e exceção pendentes", () => {
    expect(deriveRecommendationStatus(
      [{ status: "done" }],
      false,
      { hasOpenAdjustment: true },
    )).toBe("adjustment_requested");
    expect(deriveRecommendationStatus(
      [{ status: "doing" }],
      false,
      { hasPendingException: true },
    )).toBe("exception_requested");
  });
});
