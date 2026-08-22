import { describe, expect, it } from "vitest";
import { recommendationTypeLabel } from "./status-registry";

describe("recommendationTypeLabel", () => {
  it("rotula tipos canônicos PT", () => {
    expect(recommendationTypeLabel("nao_implementacao")).toBe("Não implementado");
    expect(recommendationTypeLabel("ausencia_evidencia")).toBe("Evidência não apresentada");
    expect(recommendationTypeLabel("evidencia_insuficiente")).toBe("Evidência insuficiente");
  });


  it("retorna em dash para vazio", () => {
    expect(recommendationTypeLabel(null)).toBe("—");
    expect(recommendationTypeLabel("")).toBe("—");
  });

  it("retorna Indefinido para desconhecido", () => {
    expect(recommendationTypeLabel("tipo_inexistente")).toBe("Indefinido");
  });
});
