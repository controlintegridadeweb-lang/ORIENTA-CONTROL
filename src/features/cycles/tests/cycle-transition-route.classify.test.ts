import { describe, expect, it } from "vitest";
import { canTransition, INTERMEDIATE_TRANSITION_LABELS, TRANSITION_EFFECT } from "@/shared/domain/workflow";

describe("classificação de arestas para o endpoint único", () => {
  it("3 intermediárias administrativas reconhecidas, sem efeito colateral", () => {
    for (const [f,t] of [["submitted","in_validation"],["in_validation","awaiting_adjustment"],["in_validation","validated"]] as const) {
      expect(`${f}->${t}` in INTERMEDIATE_TRANSITION_LABELS).toBe(true);
      expect(TRANSITION_EFFECT[`${f}->${t}`] ?? null).toBeNull();
    }
  });
  it("reenvio após ajuste não é exposto como transição administrativa", () => {
    expect("awaiting_adjustment->in_validation" in INTERMEDIATE_TRANSITION_LABELS).toBe(false);
    expect(TRANSITION_EFFECT["awaiting_adjustment->in_validation"] ?? null).toBeNull();
  });
  it("arestas com efeito colateral mapeadas corretamente", () => {
    expect(TRANSITION_EFFECT["draft->in_response"] ?? null).toBe("open");
    expect(TRANSITION_EFFECT["validated->completed"] ?? null).toBe("close");
    expect(TRANSITION_EFFECT["completed->in_response"] ?? null).toBe("reopen");
    expect(TRANSITION_EFFECT["validated->in_validation"] ?? null).toBe(
      "reopen_validation",
    );
  });
  it("efeito só existe para arestas válidas de avanço/reabertura", () => {
    for (const [f, t] of [
      ["draft", "in_response"],
      ["validated", "completed"],
      ["completed", "in_response"],
      ["validated", "in_validation"],
    ] as const) {
      expect(
        canTransition(f, t) || f === "completed" || f === "validated",
      ).toBe(true);
    }
    expect(TRANSITION_EFFECT["draft->completed"] ?? null).toBeNull();
  });
});
