import { describe, expect, it } from "vitest";
import { reportCycleStateLabel } from "./report-cycle-status";

describe("reportCycleStateLabel", () => {
  it.each([
    ["draft", "Rascunho"],
    ["in_response", "Em preenchimento"],
    ["submitted", "Enviado"],
    ["in_validation", "Em validação"],
    ["awaiting_adjustment", "Aguardando ajuste"],
    ["validated", "Diagnóstico concluído"],
    ["completed", "Avaliação encerrada"],
  ])("traduz o estado %s para o rótulo institucional %s", (state, expected) => {
    expect(reportCycleStateLabel(state)).toBe(expected);
  });

  it("não inventa um estado para valores ausentes ou desconhecidos", () => {
    expect(reportCycleStateLabel(null)).toBe("Situação indisponível");
    expect(reportCycleStateLabel("unknown_state")).toBe("Situação indisponível");
  });
});
