import { describe, expect, it } from "vitest";
import { actionPlanAvailabilityForCycleState } from "./availability";

describe("actionPlanAvailabilityForCycleState", () => {
  it("não cria mensagem durante a execução supervisionada", () => {
    expect(actionPlanAvailabilityForCycleState("validated")).toBeNull();
  });

  it("explica que o plano fica congelado após o encerramento", () => {
    expect(actionPlanAvailabilityForCycleState("completed")).toMatchObject({
      title: "Acompanhamento encerrado",
    });
  });

  it("explica corretamente a fase de resposta", () => {
    expect(actionPlanAvailabilityForCycleState("in_response")).toMatchObject({
      title: "Aguardando envio do diagnóstico",
    });
  });

  it("distingue complemento de validação", () => {
    expect(actionPlanAvailabilityForCycleState("awaiting_adjustment")).toMatchObject({
      title: "Correções do diagnóstico pendentes",
    });
    expect(actionPlanAvailabilityForCycleState("in_validation")).toMatchObject({
      title: "Aguardando validação",
    });
  });
});
