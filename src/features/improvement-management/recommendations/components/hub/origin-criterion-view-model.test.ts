import { describe, expect, it } from "vitest";
import { presentOriginCriterion } from "./origin-criterion-view-model";

describe("presentOriginCriterion", () => {
  it("destaca resposta Não para não implementação", () => {
    const view = presentOriginCriterion({
      questionPrompt: "Há política formal?",
      recommendationType: "nao_implementacao",
    });
    expect(view.questionPrompt).toBe("Há política formal?");
    expect(view.originatingAnswer).toBe("Não");
    expect(view.validationSituation).toBe("Resposta negativa no diagnóstico");
  });

  it("descreve ausência de evidência de forma curta", () => {
    const view = presentOriginCriterion({
      questionPrompt: "Critério",
      recommendationType: "ausencia_evidencia",
    });
    expect(view.originatingAnswer).toContain("evidência");
    expect(view.validationSituation).toBe("Evidência obrigatória não apresentada");
  });
});
