import { describe, expect, it } from "vitest";
import { deriveValidationStatus } from "../answers-status";

describe("deriveValidationStatus", () => {
  it("retorna nao_iniciada quando nao ha respostas", () => {
    expect(
      deriveValidationStatus({
        answered: 0,
        total: 10,
        cycleState: "in_response",
        hasComplementationRequested: false,
      }),
    ).toBe("nao_iniciada");
  });

  it("retorna em_preenchimento quando algumas perguntas foram respondidas", () => {
    expect(
      deriveValidationStatus({
        answered: 3,
        total: 10,
        cycleState: "in_response",
        hasComplementationRequested: false,
      }),
    ).toBe("em_preenchimento");
  });

  it("retorna completa quando todas as perguntas estao respondidas e form ainda em preenchimento", () => {
    expect(
      deriveValidationStatus({
        answered: 10,
        total: 10,
        cycleState: "in_response",
        hasComplementationRequested: false,
      }),
    ).toBe("completa");
  });

  it("retorna submetida quando todas respondidas e form passou da fase de resposta", () => {
    expect(
      deriveValidationStatus({
        answered: 10,
        total: 10,
        cycleState: "submitted",
        hasComplementationRequested: false,
      }),
    ).toBe("submetida");
  });

  it("retorna submetida para ciclo concluido (completed)", () => {
    expect(
      deriveValidationStatus({
        answered: 10,
        total: 10,
        cycleState: "completed",
        hasComplementationRequested: false,
      }),
    ).toBe("submetida");
  });

  it("prioriza em_complementacao sobre qualquer outro estado", () => {
    expect(
      deriveValidationStatus({
        answered: 10,
        total: 10,
        cycleState: "submitted",
        hasComplementationRequested: true,
      }),
    ).toBe("em_complementacao");
  });

  it("trata total zero como nao_iniciada (formulario sem perguntas)", () => {
    expect(
      deriveValidationStatus({
        answered: 0,
        total: 0,
        cycleState: "in_response",
        hasComplementationRequested: false,
      }),
    ).toBe("nao_iniciada");
  });
});
