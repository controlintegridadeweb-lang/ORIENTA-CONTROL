import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainConflictError, DomainValidationError } from "@/infrastructure/api/domain-errors";

const { commitCycleTransition, collectSubmissionQuestions } = vi.hoisted(() => ({
  commitCycleTransition: vi.fn(),
  collectSubmissionQuestions: vi.fn(),
}));

const cycleState = {
  id: "c1",
  formVersionId: "fv1",
  organizationId: "o1",
  periodLabel: "2026",
  state: "in_response" as string,
  reopenCount: 0,
  startsAt: null,
  responseDeadlineAt: null,
  validationDeadlineAt: null,
  cycleCloseAt: null,
  deadlinePolicy: "flexible_audited" as const,
  submittedLateAt: null,
  submissionDelaySeconds: null,
  submittedAt: null,
  validatedAt: null,
  closedAt: null,
  reopenedAt: null,
};

vi.mock("@/features/cycles/cycle-state-service", () => ({
  CycleStateService: class {
    require = vi.fn(async () => cycleState);
  },
}));

vi.mock("@/features/cycles/commit", () => ({
  commitCycleTransition,
}));

vi.mock("@/features/cycles/submission-collect", () => ({
  collectSubmissionQuestions,
}));

import { submitCycle } from "../submit-cycle-service";

beforeEach(() => {
  cycleState.state = "in_response";
  commitCycleTransition.mockReset();
  commitCycleTransition.mockResolvedValue({ toState: "submitted" });
  collectSubmissionQuestions.mockReset();
  collectSubmissionQuestions.mockResolvedValue([]);
});

describe("submitCycle", () => {
  it("envia diagnóstico em preenchimento para validação", async () => {
    const result = await submitCycle({} as never, "c1", "actor-1");
    expect(result).toEqual({
      cycleId: "c1",
      fromState: "in_response",
      toState: "submitted",
    });
    expect(commitCycleTransition).toHaveBeenCalledWith(expect.anything(), {
      cycleId: "c1",
      actorUserId: "actor-1",
      toState: "submitted",
      expectedFromState: "in_response",
    });
  });

  it("reenvia diagnóstico em ajuste para validação", async () => {
    cycleState.state = "awaiting_adjustment";
    commitCycleTransition.mockResolvedValue({ toState: "in_validation" });

    const result = await submitCycle({} as never, "c1", "actor-1");
    expect(result).toEqual({
      cycleId: "c1",
      fromState: "awaiting_adjustment",
      toState: "in_validation",
    });
    expect(commitCycleTransition).toHaveBeenCalledWith(expect.anything(), {
      cycleId: "c1",
      actorUserId: "actor-1",
      toState: "in_validation",
      expectedFromState: "awaiting_adjustment",
    });
  });

  it("rejeita envio fora das etapas permitidas", async () => {
    cycleState.state = "draft";
    await expect(submitCycle({} as never, "c1", "actor-1")).rejects.toBeInstanceOf(
      DomainConflictError,
    );
    expect(commitCycleTransition).not.toHaveBeenCalled();
  });

  it("rejeita chamada direta quando ainda há pergunta obrigatória sem resposta", async () => {
    collectSubmissionQuestions.mockResolvedValueOnce([
      {
        questionId: "q-pendente",
        appliesToRespondent: true,
        isNotApplicable: false,
        hasWaiver: false,
        famiEnabled: true,
        requiresEvidence: false,
        answer: null,
        hasActiveEvidence: false,
      },
    ]);

    await expect(submitCycle({} as never, "c1", "actor-1")).rejects.toBeInstanceOf(
      DomainValidationError,
    );
    expect(commitCycleTransition).not.toHaveBeenCalled();
  });
});
