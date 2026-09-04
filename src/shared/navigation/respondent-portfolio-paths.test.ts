import { describe, expect, it } from "vitest";
import {
  respondentActionWorkspacePath,
  respondentSectionActionWorkspacePath,
  respondentSectionPlanEntryPath,
  respondentSubmissionConfirmationPath,
} from "./respondent-portfolio-paths";

describe("respondentSubmissionConfirmationPath", () => {
  it("abre a confirmação do diagnóstico enviado", () => {
    expect(respondentSubmissionConfirmationPath("cycle 1")).toBe(
      "/respondente/ciclos/cycle%201/enviado?returnTo=%2Frespondente%2Fformularios",
    );
  });

  it("preserva o ano selecionado para o retorno da confirmação", () => {
    expect(
      respondentSubmissionConfirmationPath("cycle-1", "/respondente/formularios?year=2025"),
    ).toBe(
      "/respondente/ciclos/cycle-1/enviado?returnTo=%2Frespondente%2Fformularios%3Fyear%3D2025",
    );
  });

  it("preserva a lista de evidências como origem de um reenvio", () => {
    expect(
      respondentSubmissionConfirmationPath(
        "cycle-1",
        "/respondente/evidencias?view=all&status=adjustment_requested&offset=20",
      ),
    ).toBe(
      "/respondente/ciclos/cycle-1/enviado?returnTo=%2Frespondente%2Fevidencias%3Fview%3Dall%26status%3Dadjustment_requested%26offset%3D20",
    );
  });

  it("identifica a confirmação de um reenvio de correções", () => {
    expect(
      respondentSubmissionConfirmationPath("cycle-1", "/respondente/formularios", {
        submissionKind: "corrections",
      }),
    ).toBe(
      "/respondente/ciclos/cycle-1/enviado?returnTo=%2Frespondente%2Fformularios&submission=corrections",
    );
  });

  it("descarta destinos externos", () => {
    expect(
      respondentSubmissionConfirmationPath("cycle-1", "https://example.com/phishing"),
    ).toBe(
      "/respondente/ciclos/cycle-1/enviado?returnTo=%2Frespondente%2Fformularios",
    );
  });
});

describe("respondentActionWorkspacePath", () => {
  const recommendationId = "11111111-1111-4111-8111-111111111111";

  it("codifica UUID válido e preserva retorno seguro", () => {
    expect(
      respondentActionWorkspacePath(recommendationId, "acoes", {
        returnTo: "/respondente/portfolio-recomendacoes?status=generated",
      }),
    ).toBe(
      "/respondente/plano-acao/11111111-1111-4111-8111-111111111111/acoes?returnTo=%2Frespondente%2Fportfolio-recomendacoes%3Fstatus%3Dgenerated",
    );
  });

  it("usa Visão geral como entrada preferencial", () => {
    expect(respondentActionWorkspacePath(recommendationId)).toBe(
      "/respondente/plano-acao/11111111-1111-4111-8111-111111111111/visao-geral",
    );
  });

  it("rejeita identificador inválido em vez de criar rota não canônica", () => {
    expect(() => respondentActionWorkspacePath("../invalido")).toThrow(
      "recommendationId inválido",
    );
  });
});

describe("respondentSectionActionWorkspacePath", () => {
  const sectionId = "22222222-2222-4222-8222-222222222222";
  const cycleId = "33333333-3333-4333-8333-333333333333";
  const firstRecommendationId = "11111111-1111-4111-8111-111111111111";

  it("abre o workspace pela seção e pelo ciclo, não pela primeira recomendação", () => {
    const path = respondentSectionActionWorkspacePath(sectionId, cycleId, "visao-geral", {
      returnTo: "/respondente/portfolio-recomendacoes?view=action-plan",
    });
    expect(path).toBe(
      "/respondente/plano-acao/secao/22222222-2222-4222-8222-222222222222/visao-geral?cycleId=33333333-3333-4333-8333-333333333333&returnTo=%2Frespondente%2Fportfolio-recomendacoes%3Fview%3Daction-plan",
    );
    expect(path).not.toContain(firstRecommendationId);
    expect(path).not.toContain("/respondente/plano-acao/11111111");
  });

  it("aceita a aba de problemas e soluções", () => {
    expect(respondentSectionActionWorkspacePath(sectionId, cycleId, "problemas-solucoes")).toBe(
      "/respondente/plano-acao/secao/22222222-2222-4222-8222-222222222222/problemas-solucoes?cycleId=33333333-3333-4333-8333-333333333333",
    );
  });
});

describe("respondentSectionPlanEntryPath", () => {
  const sectionId = "22222222-2222-4222-8222-222222222222";
  const cycleId = "33333333-3333-4333-8333-333333333333";
  const returnTo = "/respondente/portfolio-recomendacoes?view=action-plan";

  it("usa sectionId e cycleId como entrada do plano da seção", () => {
    const path = respondentSectionPlanEntryPath(sectionId, cycleId, returnTo);
    expect(path).toContain(`/secao/${sectionId}/visao-geral`);
    expect(path).toContain(`cycleId=${cycleId}`);
    expect(path).toContain("returnTo=");
    expect(path).not.toMatch(/recommendations\[0\]/);
    expect(path).not.toContain("11111111-1111-4111-8111-111111111111");
  });

  it("volta ao retorno quando sectionId ou cycleId são inválidos", () => {
    expect(respondentSectionPlanEntryPath("invalida", cycleId, returnTo)).toBe(returnTo);
    expect(respondentSectionPlanEntryPath(sectionId, "ciclo-invalido", returnTo)).toBe(returnTo);
  });
});
