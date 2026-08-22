import { describe, expect, it, vi } from "vitest";
import { commitCycleTransition } from "./index";

function makeSupabaseSpy() {
  const rpc = vi.fn().mockResolvedValue({
    data: {
      fromState: "validated",
      toState: "completed",
      processingId: "proc-1",
      closed: true,
    },
    error: null,
  });
  return {
    rpc,
  } as unknown as Parameters<typeof commitCycleTransition>[0] & {
    rpc: typeof rpc;
  };
}

describe("commitCycleTransition", () => {
  it("encerra o ciclo sem enviar FAMI ou snapshots", async () => {
    const supabase = makeSupabaseSpy();

    await commitCycleTransition(supabase, {
      cycleId: "cycle-1",
      actorUserId: "user-1",
      toState: "completed",
      expectedFromState: "validated",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("commit_cycle_transition", {
      p_cycle_id: "cycle-1",
      p_actor_user_id: "user-1",
      p_to_state: "completed",
      p_fami_rows: null,
      p_snapshot_payload: null,
      p_expected_from_state: "validated",
    });
  });

  it("traduz alteração concorrente durante o envio", async () => {
    const supabase = makeSupabaseSpy();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "submission_not_ready" },
    });

    await expect(
      commitCycleTransition(supabase, {
        cycleId: "cycle-1",
        actorUserId: "user-1",
        toState: "submitted",
        expectedFromState: "in_response",
      }),
    ).rejects.toMatchObject({
      name: "DomainConflictError",
      message: expect.stringContaining("alteradas durante o envio"),
    });
  });

  it("orienta sobre os bloqueios da supervisão antes do encerramento", async () => {
    const supabase = makeSupabaseSpy();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "close_requires_completed_and_approved_action_plans" },
    });

    await expect(
      commitCycleTransition(supabase, {
        cycleId: "cycle-1",
        actorUserId: "user-1",
        toState: "completed",
        expectedFromState: "validated",
      }),
    ).rejects.toMatchObject({
      name: "DomainConflictError",
      message: expect.stringContaining("registre o aceite da supervisão"),
    });
  });

  it("explica que o FAMI precisa existir antes do encerramento", async () => {
    const supabase = makeSupabaseSpy();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "cycle_close_requires_finalized_diagnosis" },
    });

    await expect(
      commitCycleTransition(supabase, {
        cycleId: "cycle-1",
        actorUserId: "user-1",
        toState: "completed",
        expectedFromState: "validated",
      }),
    ).rejects.toMatchObject({
      name: "DomainConflictError",
      message: expect.stringContaining("calcule o FAMI"),
    });
  });
});
