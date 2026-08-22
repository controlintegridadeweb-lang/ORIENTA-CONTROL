import { describe, expect, it } from "vitest";
import { splitApplicableEvolutionSegments } from "./evolution-segments";

describe("splitApplicableEvolutionSegments", () => {
  it("interrompe linha e área em períodos N/A", () => {
    expect(splitApplicableEvolutionSegments([20, 30, null, 50, 60])).toEqual([
      [
        { index: 0, value: 20 },
        { index: 1, value: 30 },
      ],
      [
        { index: 3, value: 50 },
        { index: 4, value: 60 },
      ],
    ]);
  });

  it("preserva períodos aplicáveis isolados sem conectá-los", () => {
    expect(splitApplicableEvolutionSegments([null, 40, null])).toEqual([
      [{ index: 1, value: 40 }],
    ]);
  });
});
