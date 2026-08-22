import { describe, expect, it } from "vitest";
import {
  calculateFami,
  isEligibleForRecommendation,
  isEligibleForFami,
} from "./fami";
import type { QuestionInput } from "./types";

const base = (over: Partial<QuestionInput> = {}): QuestionInput => ({
  id: "q1",
  axisId: "gov",
  sectionId: "s1",
  famiEnabled: true,
  requiresEvidence: false,
  answer: "yes",
  appliesToRespondent: true,
  ...over,
});

describe("predicados FAMI vs recomendação", () => {
  it("fami_enabled=false continua elegível para recomendação", () => {
    const q = base({ famiEnabled: false, answer: "no" });
    expect(isEligibleForRecommendation(q)).toBe(true);
    expect(isEligibleForFami(q)).toBe(false);
  });

  it("waiver remove elegibilidade e pontuação", () => {
    const q = base({ waived: true });
    expect(isEligibleForRecommendation(q)).toBe(false);
    expect(isEligibleForFami(q)).toBe(false);
  });
});


describe("calculateFami", () => {
  it("aplica 1,0 sem exigência de evidência e 2,0 com evidência exigida aprovada", () => {
    const result = calculateFami([
      base({ id: "q1", requiresEvidence: false }),
      base({
        id: "q2",
        requiresEvidence: true,
        validationStatus: "approved",
      }),
      base({
        id: "q3",
        isNotApplicable: true,
        answer: "not_applicable",
      }),
    ]);

    expect(result.global.pointsPossible).toBe(3);
    expect(result.global.pointsObtained).toBe(3);
    expect(result.global.maturityLevel).toBe(5);
  });

  it("retorna N/A quando denominador zero", () => {
    const result = calculateFami([
      base({ famiEnabled: false }),
      base({ appliesToRespondent: false }),
    ]);
    expect(result.global.maturityLevel).toBe("N/A");
  });

  it("classifica o nível pelo percentual já normalizado em duas casas", () => {
    const questions = Array.from({ length: 6_669 }, (_, index) =>
      base({
        id: `q-${index}`,
        requiresEvidence: false,
        answer: index < 1_334 ? "yes" : "no",
      }),
    );

    const result = calculateFami(questions);
    expect(result.global.percentage).toBe(20);
    expect(result.global.maturityLevel).toBe(1);
  });
});
