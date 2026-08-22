import { describe, expect, it, vi } from "vitest";
import { DomainConflictError } from "@/infrastructure/api/domain-errors";
import {
  decideActionPlanDeadlineChange,
  requestActionPlanDeadlineChange,
} from "./deadline-change-service";

const requestId = "11111111-1111-4111-8111-111111111111";
const planId = "22222222-2222-4222-8222-222222222222";
const recommendationId = "33333333-3333-4333-8333-333333333333";
const organizationId = "44444444-4444-4444-8444-444444444444";
const respondentId = "55555555-5555-4555-8555-555555555555";
const adminId = "66666666-6666-4666-8666-666666666666";

function requestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: requestId,
    action_plan_id: planId,
    recommendation_id: recommendationId,
    organization_id: organizationId,
    action_revision: 3,
    previous_due_date: "2026-09-30",
    requested_due_date: "2026-11-30",
    reason: "O processo de contratação precisa de prazo adicional para conclusão.",
    status: "pending",
    requested_by: respondentId,
    requested_at: "2026-08-12T18:00:00.000Z",
    decided_by: null,
    decided_at: null,
    decision_reason: null,
    applied_action_revision: null,
    ...overrides,
  };
}

function clientWithRpc(rpcResult: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const inMock = vi.fn().mockResolvedValue({
    data: [
      { user_id: respondentId, full_name: "Respondente Teste" },
      { user_id: adminId, full_name: "Administrador Teste" },
    ],
    error: null,
  });
  const select = vi.fn().mockReturnValue({ in: inMock });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { rpc, from } as never, rpc };
}

describe("deadline-change-service", () => {
  it("registra solicitação sem alterar diretamente a ação", async () => {
    const { client, rpc } = clientWithRpc({ data: requestRow(), error: null });

    const result = await requestActionPlanDeadlineChange(
      client,
      {
        planId,
        recommendationId,
        expectedRevision: 3,
        requestedDueDate: "2026-11-30",
        reason: "O processo de contratação precisa de prazo adicional para conclusão.",
      },
      { userId: respondentId, organizationId },
    );

    expect(rpc).toHaveBeenCalledWith("request_action_plan_deadline_change", {
      p_actor_user_id: respondentId,
      p_organization_id: organizationId,
      p_plan_id: planId,
      p_recommendation_id: recommendationId,
      p_requested_due_date: "2026-11-30",
      p_reason: "O processo de contratação precisa de prazo adicional para conclusão.",
      p_expected_revision: 3,
    });
    expect(result).toMatchObject({
      id: requestId,
      actionPlanId: planId,
      previousDueDate: "2026-09-30",
      requestedDueDate: "2026-11-30",
      status: "pending",
      requestedByName: "Respondente Teste",
    });
  });

  it("mapeia segunda solicitação pendente para conflito de domínio", async () => {
    const { client } = clientWithRpc({
      data: null,
      error: { message: "action_plan_deadline_change_pending_exists" },
    });

    await expect(
      requestActionPlanDeadlineChange(
        client,
        {
          planId,
          recommendationId,
          expectedRevision: 3,
          requestedDueDate: "2026-11-30",
          reason: "O processo de contratação precisa de prazo adicional para conclusão.",
        },
        { userId: respondentId, organizationId },
      ),
    ).rejects.toBeInstanceOf(DomainConflictError);
  });

  it("aprova solicitação por RPC administrativa e devolve a revisão aplicada", async () => {
    const { client, rpc } = clientWithRpc({
      data: requestRow({
        status: "approved",
        decided_by: adminId,
        decided_at: "2026-08-12T19:00:00.000Z",
        decision_reason: "A justificativa e o novo cronograma foram aceitos.",
        applied_action_revision: 4,
      }),
      error: null,
    });

    const result = await decideActionPlanDeadlineChange(
      client,
      {
        requestId,
        decision: "approved",
        decisionReason: "A justificativa e o novo cronograma foram aceitos.",
      },
      adminId,
    );

    expect(rpc).toHaveBeenCalledWith("decide_action_plan_deadline_change", {
      p_actor_user_id: adminId,
      p_request_id: requestId,
      p_decision: "approved",
      p_decision_reason: "A justificativa e o novo cronograma foram aceitos.",
    });
    expect(result).toMatchObject({
      status: "approved",
      appliedActionRevision: 4,
      decidedByName: "Administrador Teste",
    });
  });
});
