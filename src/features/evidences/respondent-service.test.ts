import { describe, expect, it, vi } from "vitest";
import { RespondentEvidencesService } from "./respondent-service";
import type { EvidenceListItem } from "./types";

function evidence(id: string, status: EvidenceListItem["currentStatus"]): EvidenceListItem {
  return {
    id,
    responseId: `response-${id}`,
    cycleId: "11111111-1111-4111-8111-111111111111",
    cycleState: "in_response",
    organizationId: "22222222-2222-4222-8222-222222222222",
    organizationName: "Org",
    formId: "33333333-3333-4333-8333-333333333333",
    formName: "Formulário",
    formVersion: 1,
    periodLabel: "2026",
    questionId: `question-${id}`,
    questionPrompt: "Critério",
    axisName: "Eixo",
    sectionName: "Seção",
    requiresEvidence: true,
    title: id,
    description: "",
    evidenceType: "file",
    storagePath: null,
    externalLink: null,
    textBody: null,
    exceptionReason: null,
    submittedAt: "2026-07-04T00:00:00.000Z",
    submittedBy: "user",
    currentStatus: status,
    lastValidatedAt: null,
    lastJustification: null,
    history: [],
  };
}

const emptyProofDeps = {
  listProofRequests: vi.fn().mockResolvedValue([]),
  countProofRequests: vi.fn().mockResolvedValue(0),
};

describe("RespondentEvidencesService", () => {
  it("delega filtros e paginação ao banco sem recortar a página novamente", async () => {
    const list = vi.fn().mockResolvedValue({
      items: [
        evidence("pending-2", "pending"),
        evidence("adjustment-1", "adjustment_requested"),
      ],
      total: 3,
      limit: 2,
      offset: 2,
    });
    const service = new RespondentEvidencesService(
      { list } as never,
      emptyProofDeps,
    );

    const result = await service.list(
      { organizationId: "22222222-2222-4222-8222-222222222222" },
      { pendingOnly: true, limit: 2, offset: 2 },
    );

    expect(result.total).toBe(3);
    expect(result.items.map((item) => item.id)).toEqual([
      "pending-2",
      "adjustment-1",
    ]);
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingOnly: true,
        status: "adjustment_requested",
        limit: 2,
        offset: 2,
      }),
      {
        organizationId: "22222222-2222-4222-8222-222222222222",
        role: "respondent",
      },
    );
  });

  it("soma comprovação ausente à fila de ajustes", async () => {
    const proofItem = {
      ...evidence("proof-1", "adjustment_requested"),
      id: "proof:response-1",
      title: "Comprovação solicitada",
      respondentStatus: "adjustment_requested" as const,
      needsAction: true,
      lastComplementationAt: "2026-07-04T00:00:00.000Z",
    };
    const list = vi.fn().mockResolvedValue({
      items: [evidence("adjustment-1", "adjustment_requested")],
      total: 1,
      limit: 5,
      offset: 0,
    });
    const service = new RespondentEvidencesService(
      { list } as never,
      {
        listProofRequests: vi.fn().mockResolvedValue([proofItem]),
        countProofRequests: vi.fn().mockResolvedValue(1),
      },
    );

    const result = await service.list(
      { organizationId: "22222222-2222-4222-8222-222222222222" },
      { status: "adjustment_requested", pendingOnly: false, limit: 5, offset: 0 },
    );

    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.id)).toEqual([
      "proof:response-1",
      "adjustment-1",
    ]);
  });

  it("exclui adjustment_requested do histórico quando não há foco em ajuste", async () => {
    const list = vi.fn().mockResolvedValue({
      items: [evidence("approved-1", "approved")],
      total: 1,
      limit: 20,
      offset: 0,
    });
    const service = new RespondentEvidencesService(
      { list } as never,
      emptyProofDeps,
    );

    await service.list(
      { organizationId: "22222222-2222-4222-8222-222222222222" },
      { pendingOnly: false, limit: 20, offset: 0 },
    );

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ excludeStatus: "adjustment_requested" }),
      expect.anything(),
    );
  });

  it("não exclui adjustment_requested ao filtrar por status de ajuste", async () => {
    const list = vi.fn().mockResolvedValue({
      items: [evidence("adjustment-1", "adjustment_requested")],
      total: 1,
      limit: 20,
      offset: 0,
    });
    const service = new RespondentEvidencesService(
      { list } as never,
      emptyProofDeps,
    );

    await service.list(
      { organizationId: "22222222-2222-4222-8222-222222222222" },
      { status: "adjustment_requested", pendingOnly: false, limit: 20, offset: 0 },
    );

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "adjustment_requested",
      }),
      expect.anything(),
    );
  });

  it("calcula o resumo a partir das agregações do banco e da comprovação ausente", async () => {
    const getStats = vi.fn().mockResolvedValue({
      total: 10,
      aguardando_envio: 2,
      aguardando_validacao: 3,
      ajuste_solicitado: 1,
      aprovadas: 3,
      nao_aprovadas: 1,
    });
    const service = new RespondentEvidencesService(
      { getStats } as never,
      {
        listProofRequests: vi.fn().mockResolvedValue([]),
        countProofRequests: vi.fn().mockResolvedValue(2),
      },
    );

    const result = await service.stats(
      { organizationId: "22222222-2222-4222-8222-222222222222" },
      { pendingOnly: false },
    );

    expect(result).toEqual({
      enviadas: 2,
      aprovadas: 3,
      aguardando: 3,
      reprovadas: 1,
      complementacao: 3,
      overall: "action_required",
      hasPendency: true,
    });
    expect(getStats).toHaveBeenCalled();
  });
});
