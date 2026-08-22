import { beforeEach, describe, expect, it, vi } from "vitest";
import { EvidencesAdminService } from "./admin-service";
import type { EvidenceListItem } from "./types";

const loadHydratedEvidences = vi.fn();
const loadHydratedEvidencesPage = vi.fn();
const loadEvidenceMetrics = vi.fn();

vi.mock("./cycle-read-model", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./cycle-read-model")>();
  return {
    ...actual,
    loadHydratedEvidences: (...args: unknown[]) =>
      loadHydratedEvidences(...args),
    loadHydratedEvidencesPage: (...args: unknown[]) =>
      loadHydratedEvidencesPage(...args),
    loadEvidenceMetrics: (...args: unknown[]) => loadEvidenceMetrics(...args),
  };
});

function sampleItem(
  overrides: Partial<EvidenceListItem> = {},
): EvidenceListItem {
  return {
    id: "ev-1",
    responseId: "resp-1",
    cycleId: "cycle-1",
    cycleState: "in_response",
    organizationId: "org-a",
    organizationName: "Org A",
    formId: "form-1",
    formName: "Form 1",
    formVersion: 1,
    periodLabel: "2026",
    questionId: "q-1",
    questionPrompt: "Critério",
    axisName: "Eixo",
    sectionName: "Seção",
    requiresEvidence: true,
    title: "Ev A1",
    description: "",
    evidenceType: "file",
    storagePath: "/path",
    externalLink: null,
    textBody: null,
    exceptionReason: null,
    submittedAt: "2025-01-01T00:00:00.000Z",
    submittedBy: "user-1",
    currentStatus: "pending",
    lastValidatedAt: null,
    lastJustification: null,
    history: [],
    ...overrides,
  };
}

describe("EvidencesAdminService (cycle-cêntrico)", () => {
  beforeEach(() => {
    loadHydratedEvidences.mockReset();
    loadHydratedEvidencesPage.mockReset();
    loadEvidenceMetrics.mockReset();
  });

  it("lista evidências do escopo e exclui pendentes de envio no admin", async () => {
    loadHydratedEvidencesPage.mockResolvedValue({
      items: [sampleItem(), sampleItem({ id: "ev-2", title: "Ev A2" })],
      total: 2,
    });
    const svc = new EvidencesAdminService({} as never);
    const result = await svc.list({}, { role: "admin", organizationId: null });
    expect(result.total).toBe(2);
    expect(result.items.map((i) => i.title)).toEqual(["Ev A1", "Ev A2"]);
    expect(loadHydratedEvidencesPage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ excludeStatus: "pending" }),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("calcula KPIs da fila admin sem o indicador de aguardando envio", async () => {
    loadEvidenceMetrics.mockResolvedValue({
      total: 3,
      aguardando_envio: 1,
      aguardando_validacao: 1,
      ajuste_solicitado: 0,
      aprovadas: 1,
      nao_aprovadas: 0,
    });
    const svc = new EvidencesAdminService({} as never);

    const result = await svc.getStats(
      {},
      { role: "admin", organizationId: null },
    );

    expect(result).toEqual({
      total: 2,
      aguardando_envio: 0,
      aguardando_validacao: 1,
      ajuste_solicitado: 0,
      aprovadas: 1,
      nao_aprovadas: 0,
    });
    expect(loadHydratedEvidences).not.toHaveBeenCalled();
  });

  it("preserva aguardando_envio nas métricas do respondente", async () => {
    loadEvidenceMetrics.mockResolvedValue({
      total: 3,
      aguardando_envio: 1,
      aguardando_validacao: 1,
      ajuste_solicitado: 0,
      aprovadas: 1,
      nao_aprovadas: 0,
    });
    const svc = new EvidencesAdminService({} as never);

    const result = await svc.getStats(
      {},
      { role: "respondent", organizationId: "org-a" },
    );

    expect(result.aguardando_envio).toBe(1);
    expect(result.total).toBe(3);
  });

  it("não aplica exclusão de pending na listagem do respondente", async () => {
    loadHydratedEvidencesPage.mockResolvedValue({
      items: [sampleItem({ currentStatus: "pending" })],
      total: 1,
    });
    const svc = new EvidencesAdminService({} as never);
    await svc.list({}, { role: "respondent", organizationId: "org-a" });
    expect(loadHydratedEvidencesPage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ excludeStatus: undefined }),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("delega o filtro de status e a paginação ao banco", async () => {
    loadHydratedEvidencesPage.mockResolvedValue({
      items: [sampleItem({ currentStatus: "approved" })],
      total: 1,
    });
    const svc = new EvidencesAdminService({} as never);
    const result = await svc.list(
      { status: "approved" },
      { role: "admin", organizationId: null },
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.currentStatus).toBe("approved");
    expect(loadHydratedEvidencesPage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: "approved",
        excludeStatus: undefined,
      }),
      expect.any(Number),
      expect.any(Number),
    );
  });
});
