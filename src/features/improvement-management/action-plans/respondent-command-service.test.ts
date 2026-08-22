import { beforeEach, describe, expect, it, vi } from "vitest";
const { loadRecommendationScopeMock } = vi.hoisted(() => ({
  loadRecommendationScopeMock: vi.fn(),
}));

vi.mock("./cycle-read-model", () => ({
  loadRecommendationScope: loadRecommendationScopeMock,
}));

import { ActionPlansNotFoundError } from "./access";
import { RespondentActionPlanCommandService } from "./respondent-command-service";
import { DomainConflictError } from "@/infrastructure/api/domain-errors";

const recommendationId = "11111111-1111-4111-8111-111111111111";
const planId = "22222222-2222-4222-8222-222222222222";
const actorUserId = "33333333-3333-4333-8333-333333333333";
const organizationId = "44444444-4444-4444-8444-444444444444";
const responsibleUserId = "55555555-5555-4555-8555-555555555555";

const createPayload = {
  intent: "create" as const,
  recommendationId,
  actionText: "  Implantar controle institucional  ",
  startDate: "2026-08-01",
  dueDate: "2026-08-31",
  responsibleSector: "  Tecnologia da Informação  ",
  responsibleUserId,
};

function scope(overrides: Record<string, unknown> = {}) {
  return {
    recommendationId,
    cycleId: "cycle-1",
    cycleState: "validated",
    organizationId,
    formId: "form-1",
    questionId: "question-1",
    axisId: "axis-1",
    ...overrides,
  };
}

function existingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: planId,
    recommendation_id: recommendationId,
    action_text: "Implantar controle institucional",
    start_date: "2026-08-01",
    due_date: "2026-08-31",
    responsible_user_id: responsibleUserId,
    responsible_label: "Tecnologia da Informação — Alice",
    progress_percentage: 20,
    status: "doing",
    execution_notes: null,
    revision: 1,
    ...overrides,
  };
}

beforeEach(() => {
  loadRecommendationScopeMock.mockReset();
});

describe("RespondentActionPlanCommandService — criação e andamento", () => {
  it("nova ação nasce com 0% e sem cancelamento", async () => {
    loadRecommendationScopeMock.mockResolvedValue(scope());
    const rpc = vi.fn().mockResolvedValue({
      data: [{ plan_id: planId, mode: "created", revision: 1 }],
      error: null,
    });
    const service = new RespondentActionPlanCommandService({ rpc } as never);

    const result = await service.save(createPayload, {
      userId: actorUserId,
      role: "respondent",
      organizationId,
    });

    expect(result).toEqual({ planId, mode: "created", revision: 1 });
    expect(rpc).toHaveBeenCalledWith("save_respondent_action_plan", {
      p_actor_user_id: actorUserId,
      p_organization_id: organizationId,
      p_plan_id: null,
      p_recommendation_id: recommendationId,
      p_action_text: "Implantar controle institucional",
      p_due_date: "2026-08-31",
      p_start_date: "2026-08-01",
      p_responsible_sector: "Tecnologia da Informação",
      p_responsible_user_id: responsibleUserId,
      p_progress_percentage: 0,
      p_cancelled: false,
      p_expected_revision: undefined,
      p_execution_notes: null,
      p_progress_update_description: null,
    });
  });

  it("atualiza progresso mantendo dados cadastrais e registra descrição", async () => {
    loadRecommendationScopeMock.mockResolvedValue(scope());
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: existingRow(), error: null }),
          }),
        }),
      }),
    });
    const rpc = vi.fn().mockResolvedValue({
      data: [{ plan_id: planId, mode: "updated", revision: 2 }],
      error: null,
    });
    const service = new RespondentActionPlanCommandService({ rpc, from } as never);

    await service.save(
      {
        intent: "update_progress",
        planId,
        recommendationId,
        expectedRevision: 1,
        progressPercentage: 55,
        progressUpdateDescription: "Capacitação concluída e implantação iniciada.",
      },
      { userId: actorUserId, role: "respondent", organizationId },
    );

    expect(rpc).toHaveBeenCalledWith(
      "save_respondent_action_plan",
      expect.objectContaining({
        p_plan_id: planId,
        p_action_text: "Implantar controle institucional",
        p_start_date: "2026-08-01",
        p_due_date: "2026-08-31",
        p_responsible_sector: "Tecnologia da Informação",
        p_responsible_user_id: responsibleUserId,
        p_progress_percentage: 55,
        p_cancelled: false,
        p_progress_update_description: "Capacitação concluída e implantação iniciada.",
      }),
    );
  });

  it("recusa redução do percentual já registrado sem chamar a RPC", async () => {
    loadRecommendationScopeMock.mockResolvedValue(scope());
    const rpc = vi.fn();
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: existingRow(), error: null }),
          }),
        }),
      }),
    });
    const service = new RespondentActionPlanCommandService({ rpc, from } as never);

    await expect(
      service.save(
        {
          intent: "update_progress",
          planId,
          recommendationId,
          expectedRevision: 1,
          progressPercentage: 10,
          progressUpdateDescription: "Tentativa de reduzir o andamento já registrado.",
        },
        { userId: actorUserId, role: "respondent", organizationId },
      ),
    ).rejects.toMatchObject({
      name: "DomainConflictError",
      message: "O progresso da ação não pode ser reduzido. O percentual atual é 20%.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("aceita manter o percentual já registrado ao descrever a atualização", async () => {
    loadRecommendationScopeMock.mockResolvedValue(scope());
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: existingRow(), error: null }),
          }),
        }),
      }),
    });
    const rpc = vi.fn().mockResolvedValue({
      data: [{ plan_id: planId, mode: "updated", revision: 2 }],
      error: null,
    });
    const service = new RespondentActionPlanCommandService({ rpc, from } as never);

    await service.save(
      {
        intent: "update_progress",
        planId,
        recommendationId,
        expectedRevision: 1,
        progressPercentage: 20,
        progressUpdateDescription: "Mesmo percentual, com novo registro no histórico.",
      },
      { userId: actorUserId, role: "respondent", organizationId },
    );

    expect(rpc).toHaveBeenCalledWith(
      "save_respondent_action_plan",
      expect.objectContaining({
        p_progress_percentage: 20,
      }),
    );
  });

  it("explica redução bloqueada pela persistência", async () => {
    loadRecommendationScopeMock.mockResolvedValue(scope());
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: existingRow({ progress_percentage: 0 }),
              error: null,
            }),
          }),
        }),
      }),
    });
    const service = new RespondentActionPlanCommandService({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "action_plan_progress_cannot_decrease", details: null },
      }),
      from,
    } as never);

    await expect(
      service.save(
        {
          intent: "update_progress",
          planId,
          recommendationId,
          expectedRevision: 1,
          progressPercentage: 15,
          progressUpdateDescription: "Avanço que a persistência recusou.",
        },
        { userId: actorUserId, role: "respondent", organizationId },
      ),
    ).rejects.toMatchObject({
      name: "DomainConflictError",
      message: expect.stringContaining("não pode ser reduzido"),
    });
  });

  it("cancelamento exige motivo e não apaga a ação", async () => {
    loadRecommendationScopeMock.mockResolvedValue(scope());
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: existingRow(), error: null }),
          }),
        }),
      }),
    });
    const rpc = vi.fn().mockResolvedValue({
      data: [{ plan_id: planId, mode: "updated", revision: 2 }],
      error: null,
    });
    const service = new RespondentActionPlanCommandService({ rpc, from } as never);

    await service.save(
      {
        intent: "cancel",
        planId,
        recommendationId,
        expectedRevision: 1,
        observations: "Ação inviável neste ciclo.",
      },
      { userId: actorUserId, role: "respondent", organizationId },
    );

    expect(rpc).toHaveBeenCalledWith(
      "save_respondent_action_plan",
      expect.objectContaining({
        p_cancelled: true,
        p_execution_notes: "Ação inviável neste ciclo.",
        p_action_text: "Implantar controle institucional",
      }),
    );
  });

});

describe("RespondentActionPlanCommandService — edição, exclusão e acesso", () => {
  it("edita dados cadastrais preservando o prazo vigente no banco", async () => {
    loadRecommendationScopeMock.mockResolvedValue(scope());
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: existingRow({ due_date: "2026-10-15" }),
              error: null,
            }),
          }),
        }),
      }),
    });
    const rpc = vi.fn().mockResolvedValue({
      data: [{ plan_id: planId, mode: "updated", revision: 2 }],
      error: null,
    });
    const service = new RespondentActionPlanCommandService({ rpc, from } as never);

    await service.save(
      {
        intent: "edit_details",
        planId,
        recommendationId,
        expectedRevision: 1,
        actionText: "Texto atualizado da ação.",
        startDate: "2026-08-15",
        responsibleSector: "TI",
        responsibleUserId,
      },
      { userId: actorUserId, role: "respondent", organizationId },
    );

    expect(rpc).toHaveBeenCalledWith(
      "save_respondent_action_plan",
      expect.objectContaining({
        p_plan_id: planId,
        p_due_date: "2026-10-15",
        p_start_date: "2026-08-15",
      }),
    );
  });

  it("recusa edição com revisão desatualizada", async () => {
    loadRecommendationScopeMock.mockResolvedValue(scope());
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: existingRow(), error: null }),
          }),
        }),
      }),
    });
    const service = new RespondentActionPlanCommandService({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "action_plan_revision_conflict", details: null },
      }),
      from,
    } as never);

    await expect(
      service.save(
        {
          intent: "edit_details",
          planId,
          recommendationId,
          expectedRevision: 2,
          actionText: "Texto atualizado da ação.",
          startDate: "2026-08-01",
          responsibleSector: "TI",
          responsibleUserId,
        },
        { userId: actorUserId, role: "respondent", organizationId },
      ),
    ).rejects.toMatchObject({
      name: "DomainConflictError",
      message: expect.stringContaining("outra aba"),
    });
  });

  it("exclui pela RPC transacional com ator e escopo da recomendação", async () => {
    loadRecommendationScopeMock.mockResolvedValue(scope());
    const rpc = vi.fn().mockResolvedValue({
      data: [{ plan_id: planId, mode: "deleted", revision: 2 }],
      error: null,
    });
    const service = new RespondentActionPlanCommandService({ rpc } as never);

    const result = await service.delete(
      { planId, recommendationId, expectedRevision: 1 },
      { userId: actorUserId, role: "respondent", organizationId },
    );

    expect(result).toEqual({ planId, mode: "deleted", revision: 2 });
    expect(rpc).toHaveBeenCalledWith("delete_respondent_action_plan", {
      p_actor_user_id: actorUserId,
      p_organization_id: organizationId,
      p_plan_id: planId,
      p_recommendation_id: recommendationId,
      p_expected_revision: 1,
    });
  });

  it("explica que ações com histórico de alteração de prazo devem ser canceladas, não excluídas", async () => {
    loadRecommendationScopeMock.mockResolvedValue(scope());
    const service = new RespondentActionPlanCommandService({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: "violates foreign key constraint action_plan_deadline_change_requests_action_plan_id_fkey",
          details: null,
        },
      }),
    } as never);

    await expect(
      service.delete(
        { planId, recommendationId, expectedRevision: 1 },
        { userId: actorUserId, role: "respondent", organizationId },
      ),
    ).rejects.toMatchObject({
      name: "DomainConflictError",
      message: expect.stringContaining("histórico de solicitação de alteração de prazo"),
    });
  });

  it("não encontra recomendação fora do órgão", async () => {
    loadRecommendationScopeMock.mockResolvedValue(scope({ organizationId: "other-org" }));
    const service = new RespondentActionPlanCommandService({ rpc: vi.fn() } as never);
    await expect(
      service.save(createPayload, {
        userId: actorUserId,
        role: "respondent",
        organizationId,
      }),
    ).rejects.toBeInstanceOf(ActionPlansNotFoundError);
  });

  it("bloqueia cancelamento com supervisão aberta", async () => {
    loadRecommendationScopeMock.mockResolvedValue(scope());
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: existingRow(), error: null }),
          }),
        }),
      }),
    });
    const service = new RespondentActionPlanCommandService({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: "action_plan_cancel_has_open_supervision_request",
          details: null,
        },
      }),
      from,
    } as never);

    await expect(
      service.save(
        {
          intent: "cancel",
          planId,
          recommendationId,
          expectedRevision: 1,
          observations: "Motivo suficiente.",
        },
        { userId: actorUserId, role: "respondent", organizationId },
      ),
    ).rejects.toBeInstanceOf(DomainConflictError);
  });
});
