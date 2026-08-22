import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../answers-queries", () => ({
  loadFormBasic: vi.fn().mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
    name: "Diagnóstico",
    state: "published",
  }),
}));

import { FormsAnswersService } from "../answers-service";

const FORM_ID = "11111111-1111-4111-8111-111111111111";
const CYCLE_IDS = [
  "22222222-2222-4222-8222-222222222221",
  "22222222-2222-4222-8222-222222222222",
  "22222222-2222-4222-8222-222222222223",
];
const ORGANIZATION_ID = "33333333-3333-4333-8333-333333333333";

describe("FormsAnswersService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pagina respondentes no banco usando cursor e apenas remove a linha sentinela", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: CYCLE_IDS.map((cycleId, index) => ({
        cycle_id: cycleId,
        organization_id: ORGANIZATION_ID,
        organization_name: "Órgão",
        period_label: "2026",
        answered_questions: 5 - index,
        total_questions: 5,
        last_updated_at: `2026-07-1${3 - index}T12:00:00.000Z`,
        respondent_status: index === 0 ? "completa" : "em_preenchimento",
        contributor_count: 1,
      })),
      error: null,
    });
    const service = new FormsAnswersService({ rpc } as never);

    const page = await service.listRespondents(FORM_ID, { limit: 2 });

    expect(page.rows).toHaveLength(2);
    expect(page.nextCursor).toEqual({
      updatedAt: "2026-07-12T12:00:00.000Z",
      cycleId: CYCLE_IDS[1],
    });
    expect(rpc).toHaveBeenCalledWith(
      "list_form_answer_respondents_page",
      expect.objectContaining({ p_form_id: FORM_ID, p_limit: 2 }),
    );
  });

  it("obtém os indicadores por agregação, sem carregar ciclos e respostas", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        formId: FORM_ID,
        formName: "Diagnóstico",
        totalRespondents: 3,
        totalCycles: 4,
        totalQuestions: 10,
        lastAnswerAt: "2026-07-13T12:00:00.000Z",
        statusBreakdown: {
          nao_iniciada: 1,
          em_preenchimento: 1,
          completa: 1,
          submetida: 1,
          em_complementacao: 0,
        },
      },
      error: null,
    });
    const service = new FormsAnswersService({ rpc } as never);

    const overview = await service.getOverview(FORM_ID);

    expect(overview.totalCycles).toBe(4);
    expect(rpc).toHaveBeenCalledWith("get_form_answers_overview", {
      p_form_id: FORM_ID,
    });
  });
});
