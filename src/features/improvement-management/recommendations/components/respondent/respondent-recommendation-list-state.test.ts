import { describe, expect, it } from "vitest";
import {
  resolveRespondentRecommendationEmptyVariant,
  respondentRecommendationHasActiveFilters,
  type RecommendationListFilterActivity,
} from "./respondent-recommendation-list-state";

const idleAnalysis: RecommendationListFilterActivity = {
  search: "",
  status: "",
  cycleId: "",
  formId: "",
  axisId: "",
  withPlan: "all",
  pendingOnly: false,
};

const idleActionPlan: RecommendationListFilterActivity = {
  ...idleAnalysis,
  withPlan: "with",
};

describe("filtros ativos da lista de recomendações", () => {
  it("trata o escopo padrão de cada visão como ausência de filtro", () => {
    expect(respondentRecommendationHasActiveFilters(false, idleAnalysis)).toBe(false);
    expect(respondentRecommendationHasActiveFilters(true, idleActionPlan)).toBe(false);
  });

  it("reconhece busca, situação, diagnóstico e pendência como filtro", () => {
    expect(
      respondentRecommendationHasActiveFilters(false, { ...idleAnalysis, search: " uci " }),
    ).toBe(true);
    expect(
      respondentRecommendationHasActiveFilters(false, { ...idleAnalysis, status: "completed" }),
    ).toBe(true);
    expect(
      respondentRecommendationHasActiveFilters(false, { ...idleAnalysis, cycleId: "cycle-1" }),
    ).toBe(true);
    expect(
      respondentRecommendationHasActiveFilters(false, { ...idleAnalysis, formId: "form-1" }),
    ).toBe(true);
    expect(
      respondentRecommendationHasActiveFilters(false, { ...idleAnalysis, axisId: "axis-1" }),
    ).toBe(true);
    expect(
      respondentRecommendationHasActiveFilters(false, { ...idleAnalysis, pendingOnly: true }),
    ).toBe(true);
  });

  it("considera com plano um filtro só na análise", () => {
    expect(
      respondentRecommendationHasActiveFilters(false, { ...idleAnalysis, withPlan: "with" }),
    ).toBe(true);
    expect(
      respondentRecommendationHasActiveFilters(true, { ...idleActionPlan, withPlan: "all" }),
    ).toBe(true);
  });
});

describe("estado vazio da lista de recomendações", () => {
  const eligibleWithoutPlan = { canCreateActionPlan: true, hasPlan: false };
  const awaitingConsolidation = { canCreateActionPlan: false, hasPlan: false };

  it("não troca a lista por estado vazio quando há resultado", () => {
    expect(
      resolveRespondentRecommendationEmptyVariant({
        actionPlanView: false,
        rows: [eligibleWithoutPlan],
        filteredCount: 1,
        hasActiveFilters: true,
      }),
    ).toBeNull();
  });

  it("explica a ausência de recomendações quando o portfólio ainda não existe", () => {
    expect(
      resolveRespondentRecommendationEmptyVariant({
        actionPlanView: false,
        rows: [],
        filteredCount: 0,
        hasActiveFilters: false,
      }),
    ).toBe("no-recommendations");
  });

  it("diferencia filtro sem resultado nas duas visões", () => {
    expect(
      resolveRespondentRecommendationEmptyVariant({
        actionPlanView: false,
        rows: [eligibleWithoutPlan],
        filteredCount: 0,
        hasActiveFilters: true,
      }),
    ).toBe("no-results");
    expect(
      resolveRespondentRecommendationEmptyVariant({
        actionPlanView: true,
        rows: [eligibleWithoutPlan],
        filteredCount: 0,
        hasActiveFilters: true,
      }),
    ).toBe("no-section-results");
  });

  it("pede consolidação quando nenhuma recomendação pode virar plano", () => {
    expect(
      resolveRespondentRecommendationEmptyVariant({
        actionPlanView: true,
        rows: [awaitingConsolidation],
        filteredCount: 0,
        hasActiveFilters: false,
      }),
    ).toBe("awaiting-consolidation");
  });

  it("orienta a criar o plano quando já existe recomendação elegível sem ação", () => {
    expect(
      resolveRespondentRecommendationEmptyVariant({
        actionPlanView: true,
        rows: [eligibleWithoutPlan, awaitingConsolidation],
        filteredCount: 0,
        hasActiveFilters: false,
      }),
    ).toBe("no-plan-linked");
  });
});
