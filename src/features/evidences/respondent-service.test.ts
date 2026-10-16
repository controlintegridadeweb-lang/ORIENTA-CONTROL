import { describe, expect, it, vi } from "vitest";
import { DomainValidationError } from "@/infrastructure/api/domain-errors";
import { RespondentEvidencesService } from "./respondent-service";
import type { EvidenceListItem } from "./types";
import type { RespondentEvidenceItem } from "./respondent-contracts";

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

  it("exporta o conjunto inteiro, com ajustes e comprovações, quando não há situação", async () => {
    const older = {
      ...evidence("older", "approved"),
      submittedAt: "2026-07-01T00:00:00.000Z",
    };
    const newer = {
      ...evidence("newer", "submitted"),
      submittedAt: "2026-07-10T00:00:00.000Z",
    };
    const proof: RespondentEvidenceItem = {
      ...evidence("proof", "adjustment_requested"),
      id: "proof:response-1",
      submittedAt: "2026-07-05T00:00:00.000Z",
      evidenceType: "proof_request",
      respondentStatus: "adjustment_requested",
      needsAction: true,
      lastComplementationAt: "2026-07-05T00:00:00.000Z",
    };
    const list = vi.fn().mockImplementation(async (query: { offset: number }) => {
      if (query.offset === 0) {
        return { items: [older], total: 2, limit: 200, offset: 0 };
      }
      return { items: [newer], total: 2, limit: 200, offset: query.offset };
    });
    const listProofRequests = vi.fn().mockResolvedValue([proof]);
    const service = new RespondentEvidencesService(
      { list } as never,
      { listProofRequests, countProofRequests: vi.fn() },
    );

    const result = await service.listForExport(
      { organizationId: "22222222-2222-4222-8222-222222222222" },
      { pendingOnly: false },
    );

    expect(result.map((item) => item.id)).toEqual(["newer", "proof:response-1", "older"]);
    expect(list).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ pendingOnly: false, limit: 200, offset: 0, status: undefined }),
      expect.objectContaining({ role: "respondent" }),
    );
    expect(list).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ offset: 1 }),
      expect.anything(),
    );
    expect(list.mock.calls[0]?.[0]).not.toHaveProperty("excludeStatus");
  });

  it("exporta só a situação filtrada, sem comprovação solicitada", async () => {
    const list = vi.fn().mockResolvedValue({
      items: [evidence("approved-1", "approved")],
      total: 1,
      limit: 200,
      offset: 0,
    });
    const listProofRequests = vi.fn();
    const service = new RespondentEvidencesService(
      { list } as never,
      { listProofRequests, countProofRequests: vi.fn() },
    );

    const result = await service.listForExport(
      { organizationId: "22222222-2222-4222-8222-222222222222" },
      { status: "approved", pendingOnly: false },
    );

    expect(result.map((item) => item.id)).toEqual(["approved-1"]);
    expect(listProofRequests).not.toHaveBeenCalled();
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ status: "approved", pendingOnly: false }),
      expect.anything(),
    );
  });

  it("recusa a planilha quando o conjunto passa de 5000 evidências", async () => {
    const list = vi.fn().mockResolvedValue({
      items: [],
      total: 5_001,
      limit: 200,
      offset: 0,
    });
    const service = new RespondentEvidencesService(
      { list } as never,
      emptyProofDeps,
    );

    await expect(
      service.listForExport(
        { organizationId: "22222222-2222-4222-8222-222222222222" },
        { pendingOnly: false },
      ),
    ).rejects.toBeInstanceOf(DomainValidationError);
  });
});
