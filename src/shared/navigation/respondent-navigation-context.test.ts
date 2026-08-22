import { describe, expect, it } from "vitest";
import {
  isSafeRespondentListPath,
  respondentRecommendationListPath,
  respondentRecommendationPage,
  respondentReturnLabel,
  respondentReturnPathOrFallback,
  respondentCyclePath,
  respondentCycleQuestionPath,
  respondentCycleReturnLabel,
  respondentCycleReturnPathOrFallback,
  withRespondentReturnPath,
} from "./respondent-navigation-context";

describe("respondent navigation context", () => {
  it("serializes only active filters for the analysis list", () => {
    expect(
      respondentRecommendationListPath("analysis", {
        search: "evidência",
        status: "generated",
        cycleId: "cycle-1",
        formId: "",
        axisId: "axis-1",
        withPlan: "without",
        pendingOnly: true,
      }),
    ).toBe(
      "/respondente/portfolio-recomendacoes?search=evid%C3%AAncia&status=generated&cycleId=cycle-1&axisId=axis-1&pendingOnly=1&withPlan=without",
    );
  });

  it("locks the action-plan list to items that already have a plan", () => {
    expect(
      respondentRecommendationListPath("action-plan", {
        search: "",
        status: "",
        cycleId: "cycle-1",
        formId: "",
        axisId: "",
        withPlan: "all",
        pendingOnly: false,
      }),
    ).toBe("/respondente/portfolio-recomendacoes?view=action-plan&cycleId=cycle-1");
  });

  it("preserva e valida a página atual das listas", () => {
    expect(
      respondentRecommendationListPath("analysis", {
        search: "",
        status: "generated",
        cycleId: "",
        formId: "",
        axisId: "",
        withPlan: "all",
        pendingOnly: false,
        page: 4,
      }),
    ).toBe("/respondente/portfolio-recomendacoes?status=generated&page=4");
    expect(respondentRecommendationPage(new URLSearchParams("page=4"))).toBe(4);
    expect(respondentRecommendationPage(new URLSearchParams("page=-2"))).toBe(1);
    expect(
      respondentCycleReturnPathOrFallback(
        "/respondente/portfolio-recomendacoes?status=generated&page=4&admin=1",
      ),
    ).toBe("/respondente/portfolio-recomendacoes?status=generated&page=4");
  });

  it("accepts only official respondent list paths as return destinations", () => {
    const analysis = "/respondente/portfolio-recomendacoes?cycleId=cycle-1";
    expect(isSafeRespondentListPath(analysis)).toBe(true);
    expect(isSafeRespondentListPath("/respondente/plano-acao/secao/22222222-2222-4222-8222-222222222222/visao-geral?cycleId=33333333-3333-4333-8333-333333333333")).toBe(true);
    expect(isSafeRespondentListPath("https://example.com")).toBe(false);
    expect(isSafeRespondentListPath("//example.com")).toBe(false);
    expect(isSafeRespondentListPath("/respondente/plano-acao/abc/acoes")).toBe(false);
    expect(isSafeRespondentListPath("/respondente/plano-acao/secao/invalida/acoes?cycleId=cycle-1")).toBe(false);

    expect(
      withRespondentReturnPath("/respondente/plano-acao/abc/acoes", analysis),
    ).toBe(
      "/respondente/plano-acao/abc/acoes?returnTo=%2Frespondente%2Fportfolio-recomendacoes%3FcycleId%3Dcycle-1",
    );
    expect(
      respondentReturnPathOrFallback("https://example.com", "/respondente/plano-acao"),
    ).toBe("/respondente/plano-acao");
    expect(respondentReturnLabel("/respondente/plano-acao?cycleId=cycle-1")).toBe(
      "Voltar ao Plano de ação",
    );
    expect(
      respondentReturnLabel(
        "/respondente/plano-acao/secao/22222222-2222-4222-8222-222222222222/acoes?cycleId=33333333-3333-4333-8333-333333333333",
      ),
    ).toBe("Voltar ao plano da seção");
  });

  it("preserva apenas parâmetros seguros ao voltar do workspace de resposta", () => {
    expect(respondentCycleReturnPathOrFallback("/respondente/formularios?year=2025")).toBe(
      "/respondente/formularios?year=2025",
    );
    expect(respondentCycleReturnPathOrFallback("/respondente/formularios?year=2025&admin=1")).toBe(
      "/respondente/formularios?year=2025",
    );
    expect(
      respondentCycleReturnPathOrFallback(
        "/respondente/evidencias?view=all&status=adjustment_requested&offset=20&admin=1",
      ),
    ).toBe("/respondente/evidencias?view=all&status=adjustment_requested&offset=20");
    expect(
      respondentCycleReturnPathOrFallback(
        "/respondente/portfolio-recomendacoes?cycleId=cycle-1&status=generated&admin=1",
      ),
    ).toBe(
      "/respondente/portfolio-recomendacoes?status=generated&cycleId=cycle-1",
    );
    expect(
      respondentCycleReturnPathOrFallback(
        "/respondente/plano-acao?cycleId=cycle-1&search=risco&admin=1",
      ),
    ).toBe("/respondente/portfolio-recomendacoes?view=action-plan&search=risco&cycleId=cycle-1");
    expect(respondentCycleReturnPathOrFallback("/admin/ciclos?year=2025")).toBe(
      "/respondente/formularios",
    );
  });

  it("cria deep link de correção com retorno seguro e rótulo coerente", () => {
    const returnTo = "/respondente/evidencias?view=all&status=adjustment_requested";
    expect(respondentCyclePath("cycle-1", returnTo)).toBe(
      "/respondente/ciclos/cycle-1?returnTo=%2Frespondente%2Fevidencias%3Fview%3Dall%26status%3Dadjustment_requested",
    );
    expect(respondentCycleQuestionPath("cycle-1", "question-1", returnTo)).toBe(
      "/respondente/ciclos/cycle-1?questionId=question-1&returnTo=%2Frespondente%2Fevidencias%3Fview%3Dall%26status%3Dadjustment_requested",
    );
    expect(respondentCycleReturnLabel(returnTo)).toBe("Voltar às evidências");
    expect(respondentCycleReturnLabel("/respondente/plano-acao?cycleId=cycle-1")).toBe("Voltar ao Plano de ação");
    expect(respondentCycleReturnLabel("/respondente/portfolio-recomendacoes?cycleId=cycle-1")).toBe("Voltar a Recomendações");
  });

});
