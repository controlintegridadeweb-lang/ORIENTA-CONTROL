import { describe, expect, it } from "vitest";
import { evidencesForRecommendationScope } from "./recommendation-scope";
import type { EvidenceListItem } from "./types";

function evidence(overrides: Partial<EvidenceListItem>): EvidenceListItem {
  return {
    id: "e-1",
    responseId: "r-1",
    cycleId: "c-1",
    cycleState: "in_response",
    organizationId: "o-1",
    organizationName: "Organização",
    formId: "f-1",
    formName: "Formulário",
    formVersion: 1,
    periodLabel: "2026",
    questionId: "q-1",
    questionPrompt: "Critério",
    axisName: "Eixo",
    sectionName: "Seção",
    requiresEvidence: true,
    title: "arquivo.pdf",
    description: "",
    evidenceType: "file",
    storagePath: "o-1/c-1/arquivo.pdf",
    externalLink: null,
    textBody: null,
    exceptionReason: null,
    submittedAt: "2026-01-01T00:00:00.000Z",
    submittedBy: "u-1",
    currentStatus: "pending",
    lastValidatedAt: null,
    lastJustification: null,
    history: [],
    ...overrides,
  };
}

describe("evidencesForRecommendationScope", () => {
  it("filtra exclusivamente pelo questionId canônico", () => {
    const items = [
      evidence({ id: "1", questionId: "q-1", questionPrompt: "Mesmo texto" }),
      evidence({ id: "2", questionId: "q-2", questionPrompt: "Mesmo texto" }),
    ];

    expect(evidencesForRecommendationScope(items, { questionId: "q-1" })).toEqual([items[0]]);
  });
});
