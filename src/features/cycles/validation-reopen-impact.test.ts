import { describe, expect, it, vi } from "vitest";
import { getValidationReopenImpact } from "./validation-reopen-impact";
import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";

const CYCLE_ID = "76fe8b00-5d04-4b03-9a64-39377413a732";

function clientWithRpc(result: { data: unknown; error: unknown }) {
  return {
    rpc: vi.fn().mockResolvedValue(result),
  };
}

describe("getValidationReopenImpact", () => {
  it("mapeia a RPC e bloqueia quando há histórico de melhoria", async () => {
    const client = clientWithRpc({
      data: [{
        action_plan_count: 2,
        supervision_note_count: 1,
        exception_count: 0,
      }],
      error: null,
    });

    const impact = await getValidationReopenImpact(
      client as unknown as TypedSupabaseClient,
      CYCLE_ID,
    );

    expect(client.rpc).toHaveBeenCalledWith("validation_reopen_impact", {
      p_cycle_id: CYCLE_ID,
    });
    expect(impact).toEqual({
      actionPlanCount: 2,
      supervisionNoteCount: 1,
      exceptionCount: 0,
      blocked: true,
    });
  });

  it("libera a reabertura quando não há ações, supervisões nem exceções", async () => {
    const client = clientWithRpc({
      data: [{
        action_plan_count: 0,
        supervision_note_count: 0,
        exception_count: 0,
      }],
      error: null,
    });

    await expect(
      getValidationReopenImpact(client as unknown as TypedSupabaseClient, CYCLE_ID),
    ).resolves.toEqual({
      actionPlanCount: 0,
      supervisionNoteCount: 0,
      exceptionCount: 0,
      blocked: false,
    });
  });

  it("rejeita contrato inválido da RPC", async () => {
    const client = clientWithRpc({
      data: [{ action_plan_count: "muito" }],
      error: null,
    });

    await expect(
      getValidationReopenImpact(client as unknown as TypedSupabaseClient, CYCLE_ID),
    ).rejects.toThrow("contrato inválido");
  });
});
