import { describe, expect, it } from "vitest";
import { evaluateFormPublishReadiness } from "../publish-readiness";

describe("evaluateFormPublishReadiness", () => {
  it("exige nome, perguntas e vinculos para publicar", () => {
    const ready = evaluateFormPublishReadiness({
      form: { name: "Form A" },
      questionCount: 2,
      bindingPending: [],
      assignmentCount: 1,
    });
    expect(ready.canPublish).toBe(true);
    expect(ready.checks).toEqual({
      hasName: true,
      hasQuestions: true,
      bindingsComplete: true,
      hasAssignments: true,
    });
  });

  it("bloqueia publicacao com binding pendente", () => {
    const missingBindings = evaluateFormPublishReadiness({
      form: { name: "Form A" },
      questionCount: 1,
      bindingPending: [{ questionId: "q1", missing: ["defaultRecommendation"] }],
      assignmentCount: 1,
    });
    expect(missingBindings.canPublish).toBe(false);
    expect(missingBindings.checks.bindingsComplete).toBe(false);
  });

  it("bloqueia publicacao sem nome ou sem criterios", () => {
    expect(
      evaluateFormPublishReadiness({ form: { name: "  " }, questionCount: 3, bindingPending: [], assignmentCount: 1 })
        .canPublish,
    ).toBe(false);
    expect(
      evaluateFormPublishReadiness({ form: { name: "Form" }, questionCount: 0, bindingPending: [], assignmentCount: 1 })
        .canPublish,
    ).toBe(false);
  });

  it("bloqueia publicacao sem organizacao atribuida", () => {
    const readiness = evaluateFormPublishReadiness({
      form: { name: "Form" },
      questionCount: 1,
      bindingPending: [],
      assignmentCount: 0,
    });
    expect(readiness.canPublish).toBe(false);
    expect(readiness.checks.hasAssignments).toBe(false);
  });

  it("nao expoe mais o check de prazo (prazo e do ciclo)", () => {
    const r = evaluateFormPublishReadiness({
      form: { name: "Form" },
      questionCount: 1,
      bindingPending: [],
      assignmentCount: 1,
    });
    expect("hasDeadline" in r.checks).toBe(false);
  });
});
