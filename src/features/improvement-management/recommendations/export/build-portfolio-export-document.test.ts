import { describe, expect, it } from "vitest";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { computeActionSla } from "@/features/improvement-management/action-plans/domain-model";
import { buildRecommendationPortfolioExportDocument } from "./build-portfolio-export-document";
import { buildRecommendationPortfolioExportRows } from "./build-portfolio-export-rows";
import type { RecommendationPortfolioExportSource } from "./portfolio-export-types";
import { PORTFOLIO_EXPORT_MISSING_VALUE } from "./portfolio-export-types";

function makeAction(
  over: Partial<Omit<ActionPlanAction, "slaLabel">> & Pick<ActionPlanAction, "id">,
): ActionPlanAction {
  const base = {
    actionText: "Ação padrão",
    startDate: "2026-09-01",
    dueDate: "2026-11-30",
    responsibleSector: "Integridade",
    responsibleUserId: "55555555-5555-4555-8555-555555555555",
    responsibleName: "Unidade de Integridade",
    progressPercentage: 40,
    status: "in_progress" as const,
    observations: null,
    updatedAt: "2026-08-01T12:00:00.000Z",
    revision: 1,
    documents: [] as ActionPlanAction["documents"],
    ...over,
  };
  return { ...base, slaLabel: computeActionSla(base) };
}

function makeSource(
  over: Partial<RecommendationPortfolioExportSource> &
    Pick<RecommendationPortfolioExportSource, "recommendationId">,
): RecommendationPortfolioExportSource {
  return {
    formName: "Diagnóstico de Integridade 2026",
    formVersion: 1,
    periodLabel: "2026.1",
    organizationName: "Corpo de Bombeiros Militar do Rio Grande do Norte",
    axisName: "Governança",
    sectionName: "Ética e Integridade",
    sectionOrder: 1,
    questionOrder: 1,
    questionPrompt: "São adotadas ações específicas para prevenção de conflitos de interesse?",
    recommendationText:
      "Adotar medidas institucionais voltadas à prevenção de conflitos de interesse.",
    recommendationStatus: "generated",
    plans: [],
    ...over,
  };
}

function documentFromSources(sources: RecommendationPortfolioExportSource[]) {
  return buildRecommendationPortfolioExportDocument(
    buildRecommendationPortfolioExportRows(sources),
  );
}

describe("buildRecommendationPortfolioExportDocument", () => {
  it("mantém recomendação sem ação com lista vazia e sem inventar execução", () => {
    const document = documentFromSources([makeSource({ recommendationId: "rec-empty" })]);
    const recommendation = document.contexts[0]?.axes[0]?.sections[0]?.recommendations[0];

    expect(recommendation?.actions).toEqual([]);
    expect(recommendation?.recommendationStatus).toBe("Gerada");
    expect(recommendation?.questionText).toContain("conflitos de interesse");
  });

  it("agrupa várias ações na mesma recomendação sem repetir pergunta", () => {
    const document = documentFromSources([
      makeSource({
        recommendationId: "rec-multi",
        recommendationStatus: "in_action_plan",
        plans: [
          makeAction({
            id: "a-late",
            actionText: "Ação B",
            startDate: "2026-11-01",
            dueDate: "2026-12-15",
            responsibleName: "Responsável B",
            progressPercentage: 20,
          }),
          makeAction({
            id: "a-early",
            actionText: "Ação A",
            startDate: "2026-09-01",
            dueDate: "2026-10-30",
            responsibleName: "Responsável A",
            progressPercentage: 50,
          }),
        ],
      }),
    ]);

    const recommendations = document.contexts[0]?.axes[0]?.sections[0]?.recommendations;
    expect(recommendations).toHaveLength(1);
    expect(recommendations?.[0]?.actions.map((action) => action.title)).toEqual([
      "Ação A",
      "Ação B",
    ]);
    expect(recommendations?.[0]?.actions.map((action) => action.responsible)).toEqual([
      "Responsável A",
      "Responsável B",
    ]);
  });

  it("ordena eixos, seções e perguntas pela estrutura do formulário, não alfabeticamente", () => {
    const document = documentFromSources([
      makeSource({
        recommendationId: "rec-social",
        axisName: "Social",
        sectionName: "Diversidade",
        sectionOrder: 1,
        questionOrder: 1,
        questionPrompt: "Zebra social",
      }),
      makeSource({
        recommendationId: "rec-env",
        axisName: "Ambiental",
        sectionName: "Resíduos",
        sectionOrder: 2,
        questionOrder: 1,
        questionPrompt: "Pergunta ambiental",
      }),
      makeSource({
        recommendationId: "rec-gov-2",
        axisName: "Governança",
        sectionName: "Zeta",
        sectionOrder: 1,
        questionOrder: 2,
        questionPrompt: "Segunda pergunta",
      }),
      makeSource({
        recommendationId: "rec-gov-1",
        axisName: "Governança",
        sectionName: "Zeta",
        sectionOrder: 1,
        questionOrder: 1,
        questionPrompt: "Primeira pergunta",
      }),
      makeSource({
        recommendationId: "rec-gov-alpha-section",
        axisName: "Governança",
        sectionName: "Alpha",
        sectionOrder: 2,
        questionOrder: 1,
        questionPrompt: "Seção posterior",
      }),
    ]);

    const axes = document.contexts[0]?.axes ?? [];
    expect(axes.map((axis) => axis.axisName)).toEqual(["Governança", "Ambiental", "Social"]);
    expect(axes[0]?.sections.map((section) => section.sectionName)).toEqual(["Zeta", "Alpha"]);
    expect(axes[0]?.sections[0]?.sectionDisplayNumber).toBe(1);
    expect(
      axes[0]?.sections[0]?.recommendations.map((recommendation) => recommendation.questionText),
    ).toEqual(["Primeira pergunta", "Segunda pergunta"]);
  });

  it("formata progresso 0% e 100%, datas dd/MM/yyyy e ausências como travessão", () => {
    const document = documentFromSources([
      makeSource({
        recommendationId: "rec-progress",
        recommendationStatus: "in_action_plan",
        plans: [
          makeAction({
            id: "zero",
            actionText: "Começar",
            startDate: "2026-01-15",
            dueDate: "",
            responsibleName: "",
            responsibleSector: "",
            progressPercentage: 0,
            status: "not_started",
            updatedAt: "",
          }),
          makeAction({
            id: "done",
            actionText: "Concluir",
            startDate: "2026-02-01",
            dueDate: "2026-03-20",
            progressPercentage: 100,
            status: "completed",
            updatedAt: "2026-03-20T15:00:00.000Z",
          }),
        ],
      }),
    ]);

    const actions = document.contexts[0]?.axes[0]?.sections[0]?.recommendations[0]?.actions ?? [];
    expect(actions[0]?.progress).toBe("0%");
    expect(actions[0]?.startDate).toMatch(/15\/01\/2026/);
    expect(actions[0]?.endDate).toBe(PORTFOLIO_EXPORT_MISSING_VALUE);
    expect(actions[0]?.responsible).toBe(PORTFOLIO_EXPORT_MISSING_VALUE);
    expect(actions[0]?.updatedAt).toBe(PORTFOLIO_EXPORT_MISSING_VALUE);
    expect(actions[0]?.status).toBe("Não iniciado");
    expect(actions[1]?.progress).toBe("100%");
    expect(actions[1]?.endDate).toMatch(/20\/03\/2026/);
    expect(actions[1]?.status).toBe("Concluída");
  });

  it("preserva textos longos de pergunta e recomendação sem truncar", () => {
    const question = "Pergunta longa ".repeat(40).trim();
    const recommendation = "Recomendação longa ".repeat(40).trim();
    const document = documentFromSources([
      makeSource({
        recommendationId: "rec-long",
        questionPrompt: question,
        recommendationText: recommendation,
      }),
    ]);
    const item = document.contexts[0]?.axes[0]?.sections[0]?.recommendations[0];
    expect(item?.questionText).toBe(question);
    expect(item?.recommendationText).toBe(recommendation);
  });

  it("inclui ação cadastrada mesmo quando o texto da ação está vazio", () => {
    const document = documentFromSources([
      makeSource({
        recommendationId: "rec-blank-action",
        recommendationStatus: "in_action_plan",
        plans: [
          makeAction({
            id: "blank",
            actionText: "   ",
            progressPercentage: 0,
          }),
        ],
      }),
    ]);
    const actions = document.contexts[0]?.axes[0]?.sections[0]?.recommendations[0]?.actions ?? [];
    expect(actions).toHaveLength(1);
    expect(actions[0]?.title).toBe(PORTFOLIO_EXPORT_MISSING_VALUE);
    expect(actions[0]?.progress).toBe("0%");
  });
});
