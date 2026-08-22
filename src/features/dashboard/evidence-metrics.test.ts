import { describe, expect, it } from "vitest";
import { evidenceMetricsFromCounts } from "./evidence-metrics";

describe("evidenceMetricsFromCounts", () => {
  it("mapeia as contagens agregadas usadas pela consulta real", () => {
    const result = evidenceMetricsFromCounts({
      aguardando_envio: 1,
      aguardando_validacao: 2,
      ajuste_solicitado: 3,
      aprovadas: 4,
      nao_aprovadas: 5,
    });
    expect(result.pendingCount).toBe(2);
    expect(result.breakdown).toEqual({
      pending: 1,
      submitted: 2,
      adjustment_requested: 3,
      approved: 4,
      invalidated: 5,
    });
  });
});
