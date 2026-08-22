import { describe, expect, it } from "vitest";
import { computeRespondentDashboardSummary } from "./respondent-dashboard-summary";
import type { RespondentProgress } from "./contracts";

const sample: RespondentProgress[] = [
  {
    cycleId: "cycle-6",
    formId: "a",
    formName: "F1",
    periodLabel: "2026",
    formVersion: 1,
    organizationName: "Organização",
    state: "in_response",
    totalQuestions: 10,
    answeredQuestions: 5,
    submissionReady: false,
    submissionBlockCount: 5,
    complementationRequests: 1,
    resolvedComplementationRequests: 0,
  },
  {
    cycleId: "cycle-15",
    formId: "b",
    formName: "F2",
    periodLabel: "2026",
    formVersion: 1,
    organizationName: "Organização",
    state: "awaiting_adjustment",
    totalQuestions: 20,
    answeredQuestions: 10,
    submissionReady: false,
    submissionBlockCount: 10,
    complementationRequests: 2,
    resolvedComplementationRequests: 0,
  },
];

describe("computeRespondentDashboardSummary", () => {
  it("aggregates KPIs from period-filtered forms", () => {
    expect(computeRespondentDashboardSummary(sample)).toEqual({
      openForms: 2,
      totalQuestions: 30,
      totalAnswered: 15,
      totalComplementation: 3,
      progressPct: 50,
    });
  });

  it("does not count submitted or validated diagnoses as requiring action", () => {
    const tracked = sample.map((item, index) => ({
      ...item,
      state: index === 0 ? "submitted" : "validated",
    })) satisfies RespondentProgress[];

    expect(computeRespondentDashboardSummary(tracked).openForms).toBe(0);
  });

  it("não conta como pendência uma correção já resolvida", () => {
    const resolved = sample.map((item) => ({
      ...item,
      resolvedComplementationRequests: item.complementationRequests,
    }));

    expect(computeRespondentDashboardSummary(resolved).totalComplementation).toBe(0);
  });

  it("não soma perguntas de ciclos duplicados do mesmo formulário", () => {
    const duplicateCycles: RespondentProgress[] = [
      {
        ...sample[0]!,
        cycleId: "empty",
        formId: "form-integridade",
        state: "in_response",
        totalQuestions: 126,
        answeredQuestions: 0,
        submissionBlockCount: 126,
        complementationRequests: 0,
        resolvedComplementationRequests: 0,
      },
      {
        ...sample[0]!,
        cycleId: "answered",
        formId: "form-integridade",
        state: "validated",
        totalQuestions: 126,
        answeredQuestions: 126,
        submissionBlockCount: 0,
        complementationRequests: 0,
        resolvedComplementationRequests: 0,
      },
    ];

    expect(computeRespondentDashboardSummary(duplicateCycles)).toEqual({
      openForms: 0,
      totalQuestions: 126,
      totalAnswered: 126,
      totalComplementation: 0,
      progressPct: 100,
    });
  });

  it("returns zeros for empty list", () => {
    expect(computeRespondentDashboardSummary([])).toEqual({
      openForms: 0,
      totalQuestions: 0,
      totalAnswered: 0,
      totalComplementation: 0,
      progressPct: 0,
    });
  });
});
