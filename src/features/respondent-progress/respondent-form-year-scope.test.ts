import { describe, expect, it } from "vitest";
import {
  formQualifiesForRespondentDashboardYear,
  shouldShowFormOnRespondentDashboardForYear,
} from "./respondent-form-year-scope";

describe("formQualifiesForRespondentDashboardYear", () => {
  it("includes forms with responses updated in the period", () => {
    expect(formQualifiesForRespondentDashboardYear(1, 0)).toBe(true);
  });

  it("includes forms with validations in the period only", () => {
    expect(formQualifiesForRespondentDashboardYear(0, 1)).toBe(true);
  });

  it("excludes forms with no activity in the period", () => {
    expect(formQualifiesForRespondentDashboardYear(0, 0)).toBe(false);
  });
});

describe("shouldShowFormOnRespondentDashboardForYear", () => {
  it("shows new forms created in the selected year without responses", () => {
    expect(
      shouldShowFormOnRespondentDashboardForYear({
        periodYear: 2026,
        cyclePeriodLabel: "",
        responsesUpdatedInPeriod: 0,
        validationsInPeriod: 0,
        totalResponsesEver: 0,
        formCreatedAtIso: "2026-05-18T13:20:34.677Z",
      }),
    ).toBe(true);
  });

  it("hides new forms in other years until there is activity", () => {
    expect(
      shouldShowFormOnRespondentDashboardForYear({
        periodYear: 2027,
        cyclePeriodLabel: "",
        responsesUpdatedInPeriod: 0,
        validationsInPeriod: 0,
        totalResponsesEver: 0,
        formCreatedAtIso: "2026-05-18T13:20:34.677Z",
      }),
    ).toBe(false);
  });

  it("mantém um diagnóstico ativo somente no ano declarado no período", () => {
    expect(
      shouldShowFormOnRespondentDashboardForYear({
        periodYear: 2026,
        cyclePeriodLabel: "Diagnóstico 2026",
        responsesUpdatedInPeriod: 0,
        validationsInPeriod: 0,
        totalResponsesEver: 0,
        formCreatedAtIso: "2025-01-01T12:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      shouldShowFormOnRespondentDashboardForYear({
        periodYear: 2027,
        cyclePeriodLabel: "Diagnóstico 2026",
        responsesUpdatedInPeriod: 0,
        validationsInPeriod: 0,
        totalResponsesEver: 0,
        formCreatedAtIso: "2025-01-01T12:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("shows forms with activity in the selected year", () => {
    expect(
      shouldShowFormOnRespondentDashboardForYear({
        periodYear: 2027,
        cyclePeriodLabel: "",
        responsesUpdatedInPeriod: 2,
        validationsInPeriod: 0,
        totalResponsesEver: 5,
        formCreatedAtIso: "2026-01-01T12:00:00.000Z",
      }),
    ).toBe(true);
  });
});
