import { describe, expect, it } from "vitest";
import {
  DomainConflictError,
  DomainUnavailableError,
  DomainValidationError,
} from "./domain-errors";
import { userFacingErrorMessage } from "./user-facing-error";

describe("userFacingErrorMessage", () => {
  it("prioriza a primeira mensagem de validação", () => {
    const error = new DomainValidationError([{ path: "name", message: "Nome obrigatório." }]);
    expect(userFacingErrorMessage(error, "Fallback")).toBe("Nome obrigatório.");
  });

  it("preserva conflitos", () => {
    expect(userFacingErrorMessage(new DomainConflictError("Já existe."), "Fallback")).toBe(
      "Já existe.",
    );
  });

  it("preserva indisponibilidades operacionais conhecidas", () => {
    expect(
      userFacingErrorMessage(
        new DomainUnavailableError("Serviço de acesso indisponível."),
        "Fallback",
      ),
    ).toBe("Serviço de acesso indisponível.");
  });

  it("usa fallback apenas para valores desconhecidos", () => {
    expect(userFacingErrorMessage(null, "Fallback")).toBe("Fallback");
  });
});
