import { describe, expect, it, vi, beforeEach } from "vitest";
import { DomainConflictError, DomainValidationError } from "@/infrastructure/api/domain-errors";

const cycleState = {
  id: "c1",
  formVersionId: "fv1",
  organizationId: "o1",
  periodLabel: "2026",
  state: "draft" as string,
  reopenCount: 0,
  startsAt: null as string | null,
  responseDeadlineAt: null as string | null,
  validationDeadlineAt: null as string | null,
  cycleCloseAt: null as string | null,
  deadlinePolicy: "flexible_audited" as const,
  submittedLateAt: null,
  submissionDelaySeconds: null,
  submittedAt: null,
  validatedAt: null,
  closedAt: null,
  reopenedAt: null,
};

const rpcResult = vi.fn();

vi.mock("@/features/cycles/cycle-state-service", () => ({
  CycleStateService: class {
    find = vi.fn(async () => cycleState);
  },
}));

import { updateCycleSchedule } from "../update-cycle-service";

function mockSupabase() {
  return {
    rpc: rpcResult,
  };
}

beforeEach(() => {
  cycleState.state = "draft";
  cycleState.startsAt = null;
  cycleState.responseDeadlineAt = null;
  cycleState.validationDeadlineAt = null;
  cycleState.cycleCloseAt = null;
  rpcResult.mockReset();
});

describe("updateCycleSchedule", () => {
  it("rejeita quando o ciclo não está em draft", async () => {
    cycleState.state = "in_response";
    await expect(
      updateCycleSchedule(mockSupabase() as never, "c1", {
        startsAt: "2027-01-01T00:00:00.000Z",
        actorUserId: "admin",
      }),
    ).rejects.toBeInstanceOf(DomainConflictError);
  });

  it("rejeita prazo anterior ao início", async () => {
    await expect(
      updateCycleSchedule(mockSupabase() as never, "c1", {
        startsAt: "2027-06-01T00:00:00.000Z",
        responseDeadlineAt: "2027-01-01T00:00:00.000Z",
        actorUserId: "admin",
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
  });

  it("rejeita prazo que já venceu", async () => {
    await expect(
      updateCycleSchedule(mockSupabase() as never, "c1", {
        startsAt: "2026-01-01T00:00:00.000Z",
        responseDeadlineAt: "2026-01-02T23:59:59.000Z",
        actorUserId: "admin",
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
  });

  it("persiste datas em rascunho", async () => {
    rpcResult.mockResolvedValue({
      data: {
        id: "c1",
        starts_at: "2027-01-01T00:00:00.000Z",
        response_deadline_at: "2027-06-01T00:00:00.000Z",
        validation_deadline_at: null,
        cycle_close_at: null,
      },
      error: null,
    });
    const result = await updateCycleSchedule(mockSupabase() as never, "c1", {
      startsAt: "2027-01-01T00:00:00.000Z",
      responseDeadlineAt: "2027-06-01T00:00:00.000Z",
      actorUserId: "admin",
    });
    expect(result).toEqual({
      id: "c1",
      startsAt: "2027-01-01T00:00:00.000Z",
      responseDeadlineAt: "2027-06-01T00:00:00.000Z",
      validationDeadlineAt: null,
      cycleCloseAt: null,
    });
    expect(rpcResult).toHaveBeenCalledWith("update_cycle_schedule", {
      p_cycle_id: "c1",
      p_starts_at: "2027-01-01T00:00:00.000Z",
      p_response_deadline_at: "2027-06-01T00:00:00.000Z",
      p_validation_deadline_at: null,
      p_cycle_close_at: null,
      p_actor_user_id: "admin",
    });
  });

  it("persiste o cronograma completo em uma única RPC", async () => {
    rpcResult.mockResolvedValue({
      data: {
        id: "c1",
        starts_at: "2027-01-01T00:00:00.000Z",
        response_deadline_at: "2027-06-01T00:00:00.000Z",
        validation_deadline_at: "2027-07-01T00:00:00.000Z",
        cycle_close_at: "2027-08-01T00:00:00.000Z",
      },
      error: null,
    });

    const result = await updateCycleSchedule(mockSupabase() as never, "c1", {
      startsAt: "2027-01-01T00:00:00.000Z",
      responseDeadlineAt: "2027-06-01T00:00:00.000Z",
      validationDeadlineAt: "2027-07-01T00:00:00.000Z",
      cycleCloseAt: "2027-08-01T00:00:00.000Z",
      actorUserId: "admin",
    });

    expect(result).toEqual({
      id: "c1",
      startsAt: "2027-01-01T00:00:00.000Z",
      responseDeadlineAt: "2027-06-01T00:00:00.000Z",
      validationDeadlineAt: "2027-07-01T00:00:00.000Z",
      cycleCloseAt: "2027-08-01T00:00:00.000Z",
    });
    expect(rpcResult).toHaveBeenCalledWith("update_cycle_schedule", {
      p_cycle_id: "c1",
      p_starts_at: "2027-01-01T00:00:00.000Z",
      p_response_deadline_at: "2027-06-01T00:00:00.000Z",
      p_validation_deadline_at: "2027-07-01T00:00:00.000Z",
      p_cycle_close_at: "2027-08-01T00:00:00.000Z",
      p_actor_user_id: "admin",
    });
  });

  it("rejeita encerramento sem validação programada", async () => {
    await expect(
      updateCycleSchedule(mockSupabase() as never, "c1", {
        startsAt: "2027-01-01T00:00:00.000Z",
        responseDeadlineAt: "2027-06-01T00:00:00.000Z",
        cycleCloseAt: "2027-08-01T00:00:00.000Z",
        actorUserId: "admin",
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
  });

});
