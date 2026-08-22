import { describe, expect, it } from "vitest";
import type { RespondentProgress } from "./contracts";
import { selectDashboardForms } from "./respondent-dashboard-focus";

function form(
  cycleId: string,
  state: string,
  overrides: Partial<RespondentProgress> = {},
): RespondentProgress {
  return {
    cycleId,
    formId: `form-${cycleId}`,
    formName: cycleId,
    periodLabel: "2026",
    formVersion: 1,
    organizationName: "Órgão",
    state,
    totalQuestions: 10,
    answeredQuestions: 0,
    submissionReady: false,
    submissionBlockCount: 0,
    complementationRequests: 0,
    resolvedComplementationRequests: 0,
    ...overrides,
  };
}

describe("selectDashboardForms", () => {
  it("prioriza ajustes e respostas antes do histórico concluído", () => {
    const selected = selectDashboardForms([
      form("completed", "completed"),
      form("validation", "in_validation"),
      form("adjustment", "awaiting_adjustment"),
      form("response", "in_response"),
    ]);

    expect(selected.map((item) => item.cycleId)).toEqual([
      "adjustment",
      "response",
      "validation",
    ]);
  });

  it("entre ciclos do mesmo formulário, mantém o que tem respostas", () => {
    const selected = selectDashboardForms([
      form("empty", "in_response", {
        formId: "form-integridade",
        formName: "Diagnóstico de Integridade 2026",
        periodLabel: "2026.1",
        answeredQuestions: 0,
        totalQuestions: 126,
      }),
      form("answered", "validated", {
        formId: "form-integridade",
        formName: "Diagnóstico de Integridade 2026",
        periodLabel: "Diagnóstico de Integridade 2026",
        answeredQuestions: 126,
        totalQuestions: 126,
      }),
      form("done", "completed", {
        formId: "form-integridade",
        answeredQuestions: 126,
        totalQuestions: 126,
      }),
    ]);

    expect(selected.map((item) => item.cycleId)).toEqual(["answered"]);
  });

  it("mantém ciclo em preenchimento quando é o único do formulário", () => {
    const selected = selectDashboardForms([
      form("open", "in_response", { answeredQuestions: 0 }),
      form("other", "validated", {
        formId: "form-other",
        answeredQuestions: 10,
        totalQuestions: 10,
      }),
    ]);

    expect(selected.map((item) => item.cycleId)).toEqual(["open", "other"]);
  });

  it("omite apenas ciclos encerrados (completed)", () => {
    const selected = selectDashboardForms([
      form("legacy", "validated", { answeredQuestions: 10 }),
      form("done", "completed", { answeredQuestions: 10 }),
    ]);

    expect(selected.map((item) => item.cycleId)).toEqual(["legacy"]);
  });

  it("limita a lista sem alterar a coleção de origem", () => {
    const input = [
      form("one", "in_response"),
      form("two", "submitted"),
      form("three", "completed"),
    ];

    expect(selectDashboardForms(input, 2).map((item) => item.cycleId)).toEqual(["one", "two"]);
    expect(input).toHaveLength(3);
  });
});
