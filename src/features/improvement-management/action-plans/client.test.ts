import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAdminActionPlanByRecommendation,
  getAdminRecommendationActionPlanCompletionReadiness,
  getRespondentActionPlanByRecommendation,
  listRespondentActionPlanProgressUpdates,
  listRespondentSupervisionNotes,
} from "./client";
import type { ActionPlanListItem } from "./types";

const recommendationId = "123e4567-e89b-12d3-a456-426614174000";

const item: ActionPlanListItem = {
  recommendationId,
  questionId: "123e4567-e89b-12d3-a456-426614174001",
  cycleState: "validated",
  formId: "123e4567-e89b-12d3-a456-426614174002",
  formName: "Formulário",
  formVersion: 1,
  organizationId: "123e4567-e89b-12d3-a456-426614174003",
  organizationName: "Órgão",
  questionPrompt: "Pergunta",
  sectionId: "section-1",
  sectionName: "Seção",
  sectionOrder: 1,
  questionOrder: 1,
  axisName: "Eixo",
  recommendationType: "corrective",
  recommendationText: "Recomendação",
  recommendationStatus: "generated",
  plans: [],
  slaLabel: "na",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("consulta exata do detalhe da recomendação", () => {
  it("usa o endpoint específico do respondente", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ item }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getRespondentActionPlanByRecommendation(recommendationId),
    ).resolves.toEqual(item);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/respondent/action-plans/recommendations/${recommendationId}`,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("usa o endpoint específico do administrador", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ item }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getAdminActionPlanByRecommendation(recommendationId),
    ).resolves.toEqual(item);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/admin/action-plans/recommendations/${recommendationId}`,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("consulta os bloqueios reais de encerramento da recomendação", async () => {
    const readiness = {
      ready: false,
      pendingCount: 1,
      blocks: [
        {
          recommendationId,
          questionId: item.questionId,
          questionPrompt: "Pergunta",
          actionPlanId: "22222222-2222-4222-8222-222222222222",
          actionLabel: "Publicar informações",
          reason: "missing_execution_evidence",
        },
      ],
      countsByReason: {
        exception_pending: 0,
        missing_active_action: 0,
        action_not_completed: 0,
        open_supervision_request: 0,
        missing_execution_evidence: 1,
        action_not_approved: 0,
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ readiness }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getAdminRecommendationActionPlanCompletionReadiness(recommendationId),
    ).resolves.toEqual(readiness);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/admin/action-plans/recommendations/${recommendationId}/completion-readiness`,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("consulta os pareceres da supervisão pelo endpoint do respondente", async () => {
    const page = { items: [], total: 0, limit: 25, offset: 0, hasMore: false };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(page), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listRespondentSupervisionNotes(recommendationId, {
        actionPlanId: "22222222-2222-4222-8222-222222222222",
        lifecycleStatuses: ["open", "acknowledged"],
        limit: 25,
      }),
    ).resolves.toEqual(page);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/respondent/action-plans/supervision-notes?recommendationId=${recommendationId}&actionPlanId=22222222-2222-4222-8222-222222222222&limit=25&lifecycleStatus=open&lifecycleStatus=acknowledged`,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("consulta as atualizações da ação pelo endpoint do respondente", async () => {
    const items = [
      {
        id: "upd-1",
        previousPercentage: 0,
        newPercentage: 15,
        previousStatus: "not_started",
        newStatus: "in_progress",
        description: "Capacitação iniciada.",
        createdAt: "2026-08-13T12:00:00Z",
        createdByName: "Alice",
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listRespondentActionPlanProgressUpdates("22222222-2222-4222-8222-222222222222"),
    ).resolves.toEqual(items);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/respondent/action-plans/22222222-2222-4222-8222-222222222222/progress-updates",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });
});
