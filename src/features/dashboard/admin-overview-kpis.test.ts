import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  countOfficialRecommendationsForOverview,
  countPlansInProgressForOverview,
  countPublishedFormsForOverview,
  mapActionPlanStatusMetrics,
} from "./admin-overview-kpis";
import { evidenceMetricsFromCounts } from "./evidence-metrics";

function createClientMock() {
  const rpc = vi.fn();
  const select = vi.fn();
  const from = vi.fn(() => ({ select }));
  return {
    client: { rpc, from } as never,
    rpc,
    select,
    from,
  };
}

describe("mapActionPlanStatusMetrics", () => {
  it("mapeia enums do banco para chaves da UI (doing → in_progress)", () => {
    expect(
      mapActionPlanStatusMetrics([
        { status: "todo", total: 2 },
        { status: "doing", total: 5 },
        { status: "done", total: 1 },
        { status: "cancelled", total: 3 },
      ]),
    ).toEqual({
      not_started: 2,
      in_progress: 5,
      completed: 1,
      cancelled: 3,
    });
  });

  it("ignora status desconhecidos sem mascarar os válidos", () => {
    expect(
      mapActionPlanStatusMetrics([
        { status: "doing", total: "4" },
        { status: "legacy", total: 9 },
      ]),
    ).toEqual({
      not_started: 0,
      in_progress: 4,
      completed: 0,
      cancelled: 0,
    });
  });
});

describe("countPublishedFormsForOverview", () => {
  it("usa list_forms_page com state=published (mesma fonte da listagem)", async () => {
    const { client, rpc } = createClientMock();
    rpc.mockResolvedValue({
      data: [{ total_count: 1 }],
      error: null,
    });

    await expect(countPublishedFormsForOverview(client)).resolves.toBe(1);
    expect(rpc).toHaveBeenCalledWith("list_forms_page", {
      p_state: "published",
      p_search: undefined,
      p_limit: 1,
      p_offset: 0,
    });
  });

  it("banco vazio retorna zero explícito da RPC", async () => {
    const { client, rpc } = createClientMock();
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(countPublishedFormsForOverview(client)).resolves.toBe(0);
  });

  it("propaga erro da consulta", async () => {
    const { client, rpc } = createClientMock();
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(countPublishedFormsForOverview(client)).rejects.toEqual({
      message: "boom",
    });
  });
});

describe("countOfficialRecommendationsForOverview", () => {
  it("conta o read model oficial, não a tabela bruta", async () => {
    const { client, from, select } = createClientMock();
    select.mockResolvedValue({ count: 257, error: null });

    await expect(
      countOfficialRecommendationsForOverview(client),
    ).resolves.toBe(257);
    expect(from).toHaveBeenCalledWith("current_recommendation_read_model");
    expect(select).toHaveBeenCalledWith("recommendation_id", {
      count: "exact",
      head: true,
    });
  });

  it("banco vazio retorna 0", async () => {
    const { client, select } = createClientMock();
    select.mockResolvedValue({ count: 0, error: null });
    await expect(
      countOfficialRecommendationsForOverview(client),
    ).resolves.toBe(0);
  });

  it("não mascara falha como zero", async () => {
    const { client, select } = createClientMock();
    select.mockResolvedValue({ count: null, error: null });
    await expect(
      countOfficialRecommendationsForOverview(client),
    ).rejects.toThrow(/contagem ausente/i);
  });

  it("propaga erro do banco", async () => {
    const { client, select } = createClientMock();
    select.mockResolvedValue({ count: null, error: { message: "denied" } });
    await expect(
      countOfficialRecommendationsForOverview(client),
    ).rejects.toEqual({ message: "denied" });
  });
});

describe("countPlansInProgressForOverview", () => {
  it("usa o monitoramento com view=in_progress (destino do card)", async () => {
    const { client, rpc } = createClientMock();
    rpc.mockResolvedValue({
      data: { total: 0, summary: { inProgress: 0 } },
      error: null,
    });

    await expect(countPlansInProgressForOverview(client)).resolves.toBe(0);
    expect(rpc).toHaveBeenCalledWith("get_admin_action_plan_monitoring_page", {
      p_organization_id: null,
      p_form_id: null,
      p_cycle_id: null,
      p_view: "in_progress",
      p_search: null,
      p_from: null,
      p_to: null,
      p_card_filter: null,
      p_layout: "list",
      p_page: 1,
      p_page_size: 1,
    });
  });

  it("não trata falha como zero", async () => {
    const { client, rpc } = createClientMock();
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(countPlansInProgressForOverview(client)).rejects.toThrow(
      /resposta inválida/i,
    );
  });

  it("propaga erro da RPC", async () => {
    const { client, rpc } = createClientMock();
    rpc.mockResolvedValue({ data: null, error: { message: "rpc fail" } });
    await expect(countPlansInProgressForOverview(client)).rejects.toEqual({
      message: "rpc fail",
    });
  });
});

describe("evidências aguardando validação — unidade e mapeamento", () => {
  it("pendingCount usa aguardando_validacao (arquivo/link), não critérios", () => {
    const metrics = evidenceMetricsFromCounts({
      aguardando_envio: 2,
      aguardando_validacao: 373,
      ajuste_solicitado: 1,
      aprovadas: 68,
      nao_aprovadas: 30,
    });
    expect(metrics.pendingCount).toBe(373);
    expect(metrics.breakdown.submitted).toBe(373);
    expect(metrics.breakdown.pending).toBe(2);
    expect(metrics.breakdown.adjustment_requested).toBe(1);
  });
});

describe("regras de domínio documentadas nos mocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recomendações-base da biblioteca não entram no read model (consulta dedicada)", async () => {
    const { client, from, select } = createClientMock();
    select.mockResolvedValue({ count: 0, error: null });
    await countOfficialRecommendationsForOverview(client);
    expect(from).not.toHaveBeenCalledWith("recommendation_templates");
    expect(from).not.toHaveBeenCalledWith("recommendations");
    expect(from).toHaveBeenCalledWith("current_recommendation_read_model");
  });

  it("plano sem ações: monitoramento em andamento retorna total 0", async () => {
    const { client, rpc } = createClientMock();
    rpc.mockResolvedValue({ data: { total: 0 }, error: null });
    await expect(countPlansInProgressForOverview(client)).resolves.toBe(0);
  });

  it("ações doing entram como in_progress no mapa de status", () => {
    const mapped = mapActionPlanStatusMetrics([{ status: "doing", total: 3 }]);
    expect(mapped.in_progress).toBe(3);
    expect(mapped.completed).toBe(0);
  });

  it("ações done não entram como in_progress", () => {
    const mapped = mapActionPlanStatusMetrics([
      { status: "done", total: 8 },
      { status: "doing", total: 1 },
    ]);
    expect(mapped.in_progress).toBe(1);
    expect(mapped.completed).toBe(8);
  });
});
