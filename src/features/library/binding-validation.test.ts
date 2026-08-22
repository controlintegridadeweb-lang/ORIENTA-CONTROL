import { describe, expect, it } from "vitest";
import {
  computeCoverageScore,
  validateConfigurationForPublish,
} from "./binding-validation";
import { bindingHasRecommendation } from "./normalize-bindings";
import type { QuestionLibraryConfiguration } from "./binding-types";

describe("bindingHasRecommendation", () => {
  it("aceita recomendação-base com título", () => {
    expect(bindingHasRecommendation({ defaultRecommendation: { title: "Fazer X" } })).toBe(true);
  });

  it("rejeita configuração vazia", () => {
    expect(bindingHasRecommendation({})).toBe(false);
  });
});

describe("configuração operacional", () => {
  function baseBinding(over: Partial<QuestionLibraryConfiguration> = {}): QuestionLibraryConfiguration {
    return {
      questionId: "00000000-0000-4000-8000-000000000099",
      sectionId: "00000000-0000-4000-8000-000000000002",
      metric: {
        name: "Pergunta",
        answerType: "yes_no",
        interpretation: "qualitative",
      },
      bindings: { defaultRecommendation: { title: "Recomendação padrão" } },
      responseMapping: {},
      coverageScore: 100,
      updatedBy: null,
      updatedAt: new Date().toISOString(),
      ...over,
    };
  }

  it("calcula cobertura apenas quando existe recomendação-base", () => {
    expect(computeCoverageScore({ defaultRecommendation: { title: "R1" } })).toBe(100);
    expect(computeCoverageScore({})).toBe(0);
  });

  it("exige recomendação-base para toda pergunta operacional", () => {
    const complete = validateConfigurationForPublish(baseBinding());
    expect(complete).toEqual({ valid: true, missing: [] });

    const incomplete = validateConfigurationForPublish(baseBinding({ bindings: {} }));
    expect(incomplete.valid).toBe(false);
    expect(incomplete.missing).toContain("defaultRecommendation");
  });

});
