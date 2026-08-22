import { describe, expect, it } from "vitest";
import { evidenceNextStep } from "./next-step";

describe("evidenceNextStep", () => {
  it("oferece a fila somente durante a validação", () => {
    expect(evidenceNextStep("in_validation").opensValidationQueue).toBe(true);
    expect(evidenceNextStep("submitted").opensValidationQueue).toBe(false);
    expect(evidenceNextStep("awaiting_adjustment").opensValidationQueue).toBe(false);
    expect(
      evidenceNextStep("in_validation", "not_required").opensValidationQueue,
    ).toBe(false);
  });

  it("explica a próxima etapa conforme o estado do diagnóstico", () => {
    expect(evidenceNextStep("submitted").label).toContain("enviado");
    expect(evidenceNextStep("completed").description).toContain("FAMI");
  });
});
