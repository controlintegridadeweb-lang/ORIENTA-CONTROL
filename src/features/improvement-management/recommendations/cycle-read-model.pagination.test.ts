import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { queryRecommendations } from "./cycle-read-model";

function rpcRow(index: number, overrides: Record<string, unknown> = {}) {
  return {
    recommendation_id: `recommendation-${String(index).padStart(4, "0")}`,
    cycle_id: "cycle-1",
    cycle_processing_id: "processing-1",
    form_id: "form-1",
    form_name: "Diagnóstico",
    form_version: 1,
    organization_id: "organization-1",
    organization_name: "Organização",
    cycle_state: "completed",
    question_id: `question-${index}`,
    question_prompt: `Critério ${index}`,
    section_name: "Seção",
    axis_name: "Governança",
    recommendation_type: "nao_implementacao",
    source: "engine",
    trigger: null,
    origin_mode: null,
    recommendation_text: `Recomendação ${index}`,
    recommendation_status: "generated",
    created_at: new Date(Date.UTC(2026, 6, 10, 12, 0, 0) - index * 1000).toISOString(),
    has_action_plan: false,
    total_count: 1001,
    ...overrides,
  };
}

function fakeClient(rows: unknown[]) {
  const rpc = vi.fn().mockResolvedValue({ data: rows, error: null });
  return {
    client: { rpc } as unknown as SupabaseClient,
    rpc,
  };
}

describe("queryRecommendations — paginação no banco", () => {
  it("preserva a contagem total retornada pela RPC e mapeia apenas a página", async () => {
    const rows = Array.from({ length: 6 }, (_, index) => rpcRow(index + 995));
    const { client, rpc } = fakeClient(rows);

    const result = await queryRecommendations(client, { limit: 6, offset: 995 });

    expect(result.total).toBe(1001);
    expect(result.items).toHaveLength(6);
    expect(result.items[0]?.id).toBe("recommendation-0995");
    expect(result.items.at(-1)?.id).toBe("recommendation-1000");
    expect(rpc).toHaveBeenCalledWith("list_recommendations_page", expect.objectContaining({
      p_limit: 6,
      p_offset: 995,
    }));
  });

  it("preserva a situação oficial derivada pelo read model SQL", async () => {
    const result = await queryRecommendations(
      fakeClient([rpcRow(1, { recommendation_status: "dismissed", total_count: 1 })]).client,
      { limit: 10, offset: 0 },
    );
    expect(result.items[0]?.status).toBe("dismissed");
  });
});
