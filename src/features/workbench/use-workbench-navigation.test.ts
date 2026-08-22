// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { WorkbenchRow } from "./load-workbench-payload";
import { useWorkbenchNavigation } from "./use-workbench-navigation";

function row(partial: Partial<WorkbenchRow> & { questionId: string; sectionName: string }): WorkbenchRow {
  return {
    prompt: "Pergunta",
    requiresEvidence: true,
    famiEnabled: true,
    recommendationText: "",
    axisName: "Eixo",
    responseId: null,
    answer: "yes",
    notes: null,
    isNotApplicable: false,
    naJustification: null,
    naValidationStatus: null,
    naRejectionReason: null,
    evidenceId: null,
    evidenceTitle: null,
    evidenceDescription: null,
    externalLink: null,
    storagePath: null,
    validationStatus: "adjustment_requested",
    validationJustification: null,
    ...partial,
  };
}

describe("useWorkbenchNavigation", () => {
  it("com questionId de correção, agrupa só a pergunta focada", () => {
    const rows = [
      row({ questionId: "q1", sectionName: "Seção A" }),
      row({ questionId: "q2", sectionName: "Seção B", validationStatus: "approved" }),
    ];

    const { result } = renderHook(() =>
      useWorkbenchNavigation({ rows, initialFocusQuestionId: "q1" }),
    );

    expect(result.current.questionFocusMode).toBe(true);
    expect(result.current.groupedBySection).toHaveLength(1);
    expect(result.current.groupedBySection[0]?.rows.map((r) => r.questionId)).toEqual(["q1"]);
  });

  it("sem questionId, mantém todas as seções", () => {
    const rows = [
      row({ questionId: "q1", sectionName: "Seção A" }),
      row({ questionId: "q2", sectionName: "Seção B" }),
    ];

    const { result } = renderHook(() => useWorkbenchNavigation({ rows }));

    expect(result.current.questionFocusMode).toBe(false);
    expect(result.current.groupedBySection).toHaveLength(2);
  });

  it("se o questionId não existir, não esconde o formulário", () => {
    const rows = [row({ questionId: "q1", sectionName: "Seção A" })];

    const { result } = renderHook(() =>
      useWorkbenchNavigation({ rows, initialFocusQuestionId: "missing" }),
    );

    expect(result.current.groupedBySection[0]?.rows).toHaveLength(1);
  });
  it("prioriza a seção da primeira correção sem ocultar as demais", async () => {
    const rows = [
      row({
        questionId: "q1",
        sectionName: "Seção A",
        unresolvedAdjustmentRequestCount: 0,
      }),
      row({
        questionId: "q2",
        sectionName: "Seção B",
        unresolvedAdjustmentRequestCount: 1,
      }),
    ];

    const { result, rerender } = renderHook(
      ({ loadedRows, preferredQuestionId }) =>
        useWorkbenchNavigation({
          rows: loadedRows,
          preferredQuestionId,
        }),
      {
        initialProps: {
          loadedRows: [] as WorkbenchRow[],
          preferredQuestionId: undefined as string | undefined,
        },
      },
    );

    rerender({ loadedRows: rows, preferredQuestionId: "q2" });

    expect(result.current.questionFocusMode).toBe(false);
    expect(result.current.groupedBySection).toHaveLength(2);
    await waitFor(() =>
      expect(result.current.currentSectionIndex).toBe(1),
    );
  });

});
