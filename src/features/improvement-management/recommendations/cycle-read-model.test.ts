import { describe, expect, it } from "vitest";
import {
  toRecommendationStatus,
  mapRecommendationRow,
  type RecommendationJoinedRow,
} from "./cycle-read-model";

function joinedRow(
  overrides: Partial<RecommendationJoinedRow> = {},
): RecommendationJoinedRow {
  return {
    id: "rec-1",
    cycle_id: "cycle-1",
    cycle_processing_id: "processing-1",
    question_version_id: "qv-1",
    tipo: "nao",
    text: "Recomendação congelada",
    created_at: "2025-01-01T00:00:00.000Z",
    cycles: {
      organization_id: "org-1",
      state: "validated",
      organizations: { id: "org-1", name: "Órgão" },
      form_versions: {
        version: 2,
        form_id: "form-1",
        forms: { id: "form-1", name: "Formulário" },
      },
    },
    question_versions: {
      question_id: "q-1",
      prompt: "Critério?",
      section_name: "Seção A",
      axis_name: "Eixo X",
    },
    action_plans: [],
    ...overrides,
  };
}

describe("cycle-read-model", () => {
  it("mapeia linha com status derivado open → generated", () => {
    const item = mapRecommendationRow(joinedRow(), new Set());
    expect(item.status).toBe("generated");
    expect(item.formId).toBe("form-1");
    expect(item.currentText).toBe("Recomendação congelada");
    expect(item.axisName).toBe("Eixo X");
    expect(item.cycleState).toBe("validated");
  });

  it("waiver marca recomendação como dismissed", () => {
    const item = mapRecommendationRow(joinedRow(), new Set(["q-1"]));
    expect(item.status).toBe("dismissed");
    expect(toRecommendationStatus(item.derivedStatus)).toBe("dismissed");
  });

  it("plano de integridade e compliance em progresso → in_action_plan", () => {
    const item = mapRecommendationRow(
      joinedRow({ action_plans: [{ id: "ap-1", status: "doing" }] }),
      new Set(),
    );
    expect(item.status).toBe("in_action_plan");
    expect(item.hasActionPlan).toBe(true);
  });
});
