import { describe, expect, it } from "vitest";
import type { WorkbenchRow } from "./load-workbench-payload";
import {
  countUnresolvedAdjustments,
  unresolvedAdjustmentRows,
} from "./adjustment-progress";

function row(
  questionId: string,
  overrides: Partial<WorkbenchRow> = {},
): WorkbenchRow {
  return {
    questionId,
    prompt: questionId,
    requiresEvidence: true,
    famiEnabled: true,
    recommendationText: "",
    axisName: "Governança",
    sectionName: "Integridade",
    responseId: `response-${questionId}`,
    answer: "yes",
    notes: null,
    isNotApplicable: false,
    naJustification: null,
    naValidationStatus: null,
    naRejectionReason: null,
    evidenceId: `evidence-${questionId}`,
    evidenceTitle: "evidencia.pdf",
    evidenceDescription: null,
    externalLink: null,
    storagePath: "evidencia.pdf",
    validationStatus: "adjustment_requested",
    validationJustification: "Atualize o documento.",
    hasAdjustmentRequest: true,
    adjustmentRequestCount: 1,
    resolvedAdjustmentRequestCount: 0,
    unresolvedAdjustmentRequestCount: 1,
    hasResolvedAllAdjustments: false,
    ...overrides,
  };
}

describe("progresso das correções", () => {
  it("considera pendente somente a devolutiva sem evidência substituta", () => {
    const rows = [
      row("pending"),
      row("resolved", {
        resolvedAdjustmentRequestCount: 1,
        unresolvedAdjustmentRequestCount: 0,
        hasResolvedAllAdjustments: true,
      }),
      row("approved", {
        validationStatus: "approved",
        hasAdjustmentRequest: false,
        unresolvedAdjustmentRequestCount: 0,
        hasResolvedAllAdjustments: true,
      }),
    ];

    expect(unresolvedAdjustmentRows(rows).map((item) => item.questionId)).toEqual([
      "pending",
    ]);
  });

  it("ignora a pergunta aberta no deep link ao contar outras pendências", () => {
    const rows = [row("focused"), row("other")];
    expect(countUnresolvedAdjustments(rows, "focused")).toBe(1);
  });

  it("conta cada evidência devolvida, mesmo quando pertencem à mesma pergunta", () => {
    const rows = [
      row("multiple", {
        adjustmentRequestCount: 3,
        resolvedAdjustmentRequestCount: 1,
        unresolvedAdjustmentRequestCount: 2,
      }),
    ];

    expect(countUnresolvedAdjustments(rows)).toBe(2);
    expect(unresolvedAdjustmentRows(rows)).toHaveLength(1);
  });

  it("conta comprovação ausente como pendência de correção", () => {
    const rows = [
      row("prova", {
        evidenceId: null,
        evidenceTitle: null,
        validationStatus: null,
        proofRequested: true,
        hasAdjustmentRequest: true,
        adjustmentRequestCount: 1,
        resolvedAdjustmentRequestCount: 0,
        unresolvedAdjustmentRequestCount: 1,
        hasResolvedAllAdjustments: false,
      }),
    ];

    expect(countUnresolvedAdjustments(rows)).toBe(1);
    expect(unresolvedAdjustmentRows(rows).map((item) => item.questionId)).toEqual([
      "prova",
    ]);
  });
});
