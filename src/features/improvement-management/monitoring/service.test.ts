import { describe, expect, it, vi } from "vitest";
import { AdminMonitoringService } from "./service";

const IDS = {
  recommendation: "11111111-1111-4111-8111-111111111111",
  cycle: "22222222-2222-4222-8222-222222222222",
  form: "33333333-3333-4333-8333-333333333333",
  organization: "44444444-4444-4444-8444-444444444444",
  question: "55555555-5555-4555-8555-555555555555",
  section: "66666666-6666-4666-8666-666666666666",
  axis: "77777777-7777-4777-8777-777777777777",
  plan: "88888888-8888-4888-8888-888888888888",
};

function baseRow() {
  return {
    recommendation_id: IDS.recommendation,
    cycle_id: IDS.cycle,
    cycle_state: "validated",
    period_label: "2026",
    form_id: IDS.form,
    form_name: "Diagnóstico 2026",
    form_version: 1,
    organization_id: IDS.organization,
    organization_name: "Órgão",
    question_id: IDS.question,
    question_prompt: "Critério",
    section_id: IDS.section,
    section_name: "Governança",
    axis_id: IDS.axis,
    axis_name: "Governança",
    recommendation_type: "base",
    recommendation_text: "Implementar controle",
    recommendation_status: "in_action_plan",
    recommendation_created_at: "2026-07-01T12:00:00.000Z",
  };
}

function commonPayload(items: unknown[], summary: Record<string, number>) {
  return {
    items,
    summary,
    total: items.length,
    paginationTotal: items.length,
    page: 1,
    pageSize: 10,
    totalPages: 1,
    layout: "list",
    selectedCycleLabel: null,
  };
}

describe("AdminMonitoringService", () => {
  it("pagina recomendações diretamente pela RPC e preserva o modelo da interface", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: commonPayload(
        [{
          ...baseRow(),
          action_plans: [{
            id: IDS.plan,
            action_text: "Criar procedimento",
            due_date: "2026-08-01",
            responsible_label: "Controle — Ana",
            progress_percentage: 55,
            status: "doing",
            execution_notes: null,
            updated_at: "2026-07-10T12:00:00.000Z",
            revision: 1,
          }],
        }],
        {
          total: 1,
          withoutPlan: 0,
          withPlan: 1,
          inExecution: 1,
          completed: 0,
          overdue: 0,
        },
      ),
      error: null,
    });
    const service = new AdminMonitoringService({ rpc } as never);

    const result = await service.listRecommendations({ page: 1, pageSize: 10 });

    expect(result.items[0]).toMatchObject({
      recommendationId: IDS.recommendation,
      planId: IDS.plan,
      organizationName: "Órgão",
      progress: 55,
    });
    expect(rpc).toHaveBeenCalledWith(
      "get_admin_recommendation_monitoring_page",
      expect.objectContaining({ p_page: 1, p_page_size: 10 }),
    );
  });

  it("pagina cada ação do plano no banco sem carregar recomendações fora da página", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: commonPayload(
        [{
          ...baseRow(),
          plan_id: IDS.plan,
          action_text: "Criar procedimento",
          start_date: "2026-07-01",
          due_date: "2026-08-01",
          section_order: 2,
          question_order: 4,
          responsible_label: "Controle — Ana",
          progress_percentage: 55,
          plan_status: "doing",
          execution_notes: null,
          updated_at: "2026-07-10T12:00:00.000Z",
          revision: 1,
          action_count: 2,
        }],
        {
          total: 1,
          inProgress: 1,
          completed: 0,
          overdue: 0,
          withoutResponsible: 0,
          dueSoon: 0,
          highRisk: 0,
          lowProgress: 0,
        },
      ),
      error: null,
    });
    const service = new AdminMonitoringService({ rpc } as never);

    const result = await service.listActionPlans({ page: 1, pageSize: 10 });

    expect(result.items[0]).toMatchObject({
      planId: IDS.plan,
      planStatus: "in_progress",
      responsibleSector: "Controle",
      responsibleName: "Ana",
      totalActionsForRecommendation: 2,
      startDate: "2026-07-01",
      sectionOrder: 2,
      questionOrder: 4,
    });
    expect(rpc).toHaveBeenCalledWith(
      "get_admin_action_plan_monitoring_page",
      expect.objectContaining({ p_page: 1, p_page_size: 10 }),
    );
  });
});
