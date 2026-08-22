import { describe, expect, it } from "vitest";
import { DomainValidationError } from "@/infrastructure/api/domain-errors";
import { dispatchEvidenceAdjustments } from "./evidence-adjustment-dispatch-service";

function rpcClient(result: { data: unknown; error: unknown }) {
  return {
    rpc: async () => result,
  } as unknown as Parameters<typeof dispatchEvidenceAdjustments>[0];
}

describe("dispatchEvidenceAdjustments", () => {
  it("envia todas as solicitações preparadas em uma única transição", async () => {
    const result = await dispatchEvidenceAdjustments(
      rpcClient({
        data: {
          cycleId: "c1",
          fromState: "in_validation",
          toState: "awaiting_adjustment",
          adjustmentCount: 3,
          proofRequestCount: 0,
        },
        error: null,
      }),
      "c1",
      "u1",
    );

    expect(result.adjustmentCount).toBe(3);
    expect(result.proofRequestCount).toBe(0);
    expect(result.totalCount).toBe(3);
    expect(result.toState).toBe("awaiting_adjustment");
  });

  it("soma comprovação ausente ao total enviado ao respondente", async () => {
    const result = await dispatchEvidenceAdjustments(
      rpcClient({
        data: {
          cycleId: "c1",
          fromState: "in_validation",
          toState: "awaiting_adjustment",
          adjustmentCount: 0,
          proofRequestCount: 2,
        },
        error: null,
      }),
      "c1",
      "u1",
    );

    expect(result.adjustmentCount).toBe(0);
    expect(result.proofRequestCount).toBe(2);
    expect(result.totalCount).toBe(2);
  });

  it("impede o envio enquanto a fila possui itens pendentes", async () => {
    await expect(
      dispatchEvidenceAdjustments(
        rpcClient({
          data: null,
          error: { message: "validation_queue_has_pending_items: 2" },
        }),
        "c1",
        "u1",
      ),
    ).rejects.toBeInstanceOf(DomainValidationError);
  });
});
