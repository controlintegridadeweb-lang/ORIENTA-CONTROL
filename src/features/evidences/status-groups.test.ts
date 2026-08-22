import { describe, expect, it } from "vitest";
import {
  aggregateKpiCounts,
  statusToVisualGroup,
} from "./status-groups";
import type { ValidationStatus } from "./schemas";

describe("statusToVisualGroup", () => {
  it("separa envio, validação e ajuste solicitado", () => {
    expect(statusToVisualGroup("pending")).toBe("aguardando_envio");
    expect(statusToVisualGroup("submitted")).toBe("aguardando_validacao");
    expect(statusToVisualGroup("adjustment_requested")).toBe("ajuste_solicitado");
    expect(statusToVisualGroup("not_required")).toBeNull();
    expect(statusToVisualGroup("approved")).toBe("aprovadas");
    expect(statusToVisualGroup("invalidated")).toBe("nao_aprovadas");
  });
});

describe("aggregateKpiCounts", () => {
  it("não trata evidência não exigida como pendência de validação", () => {
    const items: { currentStatus: ValidationStatus }[] = [
      { currentStatus: "pending" },
      { currentStatus: "submitted" },
      { currentStatus: "adjustment_requested" },
      { currentStatus: "approved" },
      { currentStatus: "invalidated" },
      { currentStatus: "not_required" },
    ];
    const result = aggregateKpiCounts(items);
    expect(result.total).toBe(6);
    expect(result.aguardando_envio).toBe(1);
    expect(result.aguardando_validacao).toBe(1);
    expect(result.ajuste_solicitado).toBe(1);
    expect(result.aprovadas).toBe(1);
    expect(result.nao_aprovadas).toBe(1);
  });
});
