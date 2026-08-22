import { describe, expect, it } from "vitest";

import { queryActionPlanRecommendationRows } from "./cycle-read-model";

function recommendationRow(index: number) {
  return {
    id: `recommendation-${index}`,
    cycle_id: "cycle-1",
    cycle_processing_id: "processing-1",
    question_version_id: `question-version-${index}`,
    tipo: "nao_implementacao",
    text: `Recomendação ${index}`,
    created_at: new Date(Date.UTC(2026, 6, 10, 12, 0, 0) - index * 1000).toISOString(),
    cycles: {
      id: "cycle-1",
      period_label: "2026",
      organization_id: "organization-1",
      state: "completed",
      organizations: { id: "organization-1", name: "Organização" },
      form_versions: {
        version: 1,
        form_id: "form-1",
        forms: { id: "form-1", name: "Diagnóstico" },
      },
    },
    question_versions: {
      question_id: `question-${index}`,
      prompt: `Critério ${index}`,
      section_name: "Seção",
      section_order: 1,
      axis_name: "Governança",
      axis_id: "axis-1",
      section_id: "section-1",
    },
    action_plans: [],
  };
}

function fakeClient(recommendations: unknown[], waiverSnapshots: unknown[] = []) {
  return {
    from(table: string) {
      const query = {
        select: () => query,
        order: () => query,
        in: () => query,
        eq: () => query,
        async range(from: number, to: number) {
          return {
            data:
              table === "recommendations"
                ? recommendations.slice(from, to + 1)
                : table === "processing_waiver_snapshots"
                  ? waiverSnapshots.slice(from, to + 1)
                  : [],
            error: null,
          };
        },
        then(resolve: (value: { data: unknown[]; error: null }) => void) {
          resolve({ data: [], error: null });
        },
      };
      return query;
    },
  } as never;
}

describe("queryActionPlanRecommendationRows", () => {
  it("consome todas as páginas de recomendações acima de 1000 linhas", async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => recommendationRow(index));

    const result = await queryActionPlanRecommendationRows(fakeClient(rows), {
      cycleProcessingId: "processing-1",
    });

    expect(result).toHaveLength(1001);
    expect(result.at(-1)?.id).toBe("recommendation-1000");
  });

  it("usa o snapshot de dispensas para diagnóstico concluído", async () => {
    const [row] = [recommendationRow(1)];
    const result = await queryActionPlanRecommendationRows(
      fakeClient([row], [
        { cycle_processing_id: "processing-1", question_id: "question-1" },
      ]),
      { cycleProcessingId: "processing-1" },
    );
    expect(result[0]?.status).toBe("dismissed");
  });
});
