import { describe, expect, it } from "vitest";
import { validationFailureMessage } from "./public-errors";

describe("validationFailureMessage", () => {
  it("traduz conflitos concorrentes sem expor detalhes internos", () => {
    expect(validationFailureMessage("validation_conflict")).toBe(
      "O parecer foi alterado por outro administrador. A fila foi atualizada; revise o estado atual e tente novamente.",
    );
  });

  it("usa mensagem pública genérica para códigos desconhecidos", () => {
    const message = validationFailureMessage(
      "duplicate key value violates unique constraint evidences_pkey",
    );

    expect(message).toBe(
      "Não foi possível registrar o parecer. Atualize a fila e tente novamente.",
    );
    expect(message).not.toContain("constraint");
  });
});
