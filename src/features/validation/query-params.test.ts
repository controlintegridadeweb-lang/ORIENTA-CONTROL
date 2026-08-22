import { describe, expect, it } from "vitest";
import { resolveValidationQueueQuery } from "./query-params";

describe("resolveValidationQueueQuery", () => {
  it("aceita um evidenceId válido para navegação direta", () => {
    const query = resolveValidationQueueQuery({
      evidenceId: "123e4567-e89b-42d3-a456-426614174000",
    });
    expect(query.targetEvidenceId).toBe(
      "123e4567-e89b-42d3-a456-426614174000",
    );
  });

  it("ignora evidenceId inválido sem quebrar a fila", () => {
    const query = resolveValidationQueueQuery({ evidenceId: "invalido" });
    expect(query.targetEvidenceId).toBeNull();
  });
});
