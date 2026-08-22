import { describe, expect, it, vi } from "vitest";
import { loadValidationFinalizationReadiness } from "./validation-finalization-readiness-repository";

const CYCLE_ID = "00000000-0000-4000-8000-000000000001";

function blockers() {
  return {
    pendingEvidence: 0,
    pendingNotApplicable: 0,
    undecidedAbsentProof: 0,
    incompleteResponses: 0,
    missingRecommendations: 0,
    missingWorkingProcessing: false,
  };
}

describe("loadValidationFinalizationReadiness", () => {
  it("consulta todos os ciclos em uma única RPC e valida o contrato", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ cycle_id: CYCLE_ID, ready: true, blockers: blockers() }],
      error: null,
    });

    const result = await loadValidationFinalizationReadiness(
      { rpc } as never,
      [CYCLE_ID, CYCLE_ID],
    );

    expect(rpc).toHaveBeenCalledWith("list_validation_finalization_readiness", {
      p_cycle_ids: [CYCLE_ID],
    });
    expect(result).toEqual([
      { cycleId: CYCLE_ID, ready: true, blockers: blockers() },
    ]);
  });

  it("não consulta o banco quando não há ciclos em validação", async () => {
    const rpc = vi.fn();
    const result = await loadValidationFinalizationReadiness({ rpc } as never, []);

    expect(result).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });
});
