import { beforeEach, describe, expect, it, vi } from "vitest";

const state: {
  itemCount: number;
  requestedRanges: Array<[number, number]>;
} = {
  itemCount: 0,
  requestedRanges: [],
};

vi.mock("@/infrastructure/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "automation_jobs") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "11111111-1111-4111-8111-111111111111",
                  kind: "respondent_import",
                  status: "completed",
                  result_summary: { total: state.itemCount },
                  error_message: null,
                  created_at: "2026-07-22T00:00:00.000Z",
                  started_at: "2026-07-22T00:00:01.000Z",
                  completed_at: "2026-07-22T00:01:00.000Z",
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "automation_job_items") {
        const query = {
          select: () => query,
          eq: () => query,
          order: () => query,
          range: async (from: number, to: number) => {
            state.requestedRanges.push([from, to]);
            const upper = Math.min(to + 1, state.itemCount);
            const data = Array.from({ length: Math.max(0, upper - from) }, (_, index) => {
              const row = from + index + 2;
              return {
                entity_id: String(row),
                status: "succeeded",
                message: "Respondente criado.",
                output: { identity: `usuario-${row}@exemplo.gov.br` },
              };
            });
            return { data, error: null };
          },
        };
        return query;
      }

      throw new Error(`Tabela não simulada: ${table}`);
    },
  })),
}));

import { getAutomationJobStatus } from "./job-status-service";

beforeEach(() => {
  state.itemCount = 0;
  state.requestedRanges = [];
});

describe("getAutomationJobStatus", () => {
  it("pagina até recuperar todos os 2.000 resultados do lote", async () => {
    state.itemCount = 2_000;

    const job = await getAutomationJobStatus("11111111-1111-4111-8111-111111111111");

    expect(job?.results).toHaveLength(2_000);
    expect(job?.results.at(0)?.row).toBe(2);
    expect(job?.results.at(-1)?.row).toBe(2_001);
    expect(state.requestedRanges).toEqual([
      [0, 499],
      [500, 999],
      [1_000, 1_499],
      [1_500, 1_999],
      [2_000, 2_499],
    ]);
  });
});
