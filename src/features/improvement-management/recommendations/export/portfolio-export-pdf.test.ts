import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { computeActionSla } from "@/features/improvement-management/action-plans/domain-model";
import { buildRecommendationPortfolioExportDocument } from "./build-portfolio-export-document";
import { buildRecommendationPortfolioExportRows } from "./build-portfolio-export-rows";
import { buildRecommendationPortfolioPdf } from "./portfolio-export-pdf";
import { PORTFOLIO_PDF_SPACE, actionPlanPdfContextFields, portfolioAxisBarColor } from "./portfolio-export-pdf-layout";
import { measureRecommendationCardMinHeight, PORTFOLIO_PDF_CARD_OPTIONS } from "./portfolio-export-pdf-card";
import { createBasicPdfTextContext } from "@/shared/export/basic-pdf-text";
import { hexToPdfRgb } from "@/shared/export/pdf-color";
import { getAxisTheme } from "@/shared/theme/axis-theme";
import type { RecommendationPortfolioExportSource } from "./portfolio-export-types";

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
    sectionName: "Governança e Estrutura de Integridade",
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

describe("buildRecommendationPortfolioPdf", () => {
  it("gera PDF válido vazio e com recomendações de um, vários e nenhum plano", async () => {
    const rows = buildRecommendationPortfolioExportRows([
      makeSource({ recommendationId: "rec-empty" }),
      makeSource({
        recommendationId: "rec-one",
        questionOrder: 2,
        recommendationStatus: "in_action_plan",
        plans: [makeAction({ id: "only" })],
      }),
      makeSource({
        recommendationId: "rec-many",
        questionOrder: 3,
        recommendationStatus: "in_action_plan",
        plans: [
          makeAction({ id: "a1", actionText: "Primeira ação vinculada" }),
          makeAction({
            id: "a2",
            actionText: "Segunda ação vinculada com texto mais longo para quebra de linha",
            startDate: "2026-10-01",
            dueDate: "2026-12-01",
            progressPercentage: 0,
          }),
        ],
      }),
    ]);

    const empty = await buildRecommendationPortfolioPdf([]);
    expect(empty.filename).toMatch(/^portfolio-recomendacoes-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(Buffer.from(empty.content).subarray(0, 4).toString()).toBe("%PDF");

    const populated = await buildRecommendationPortfolioPdf(rows);
    const pdf = await PDFDocument.load(populated.content);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("aceita textos longos, múltiplos eixos e quebra de página sem lançar", async () => {
    const longText = "Texto institucional extenso sobre integridade pública. ".repeat(80);
    const rows = buildRecommendationPortfolioExportRows([
      makeSource({
        recommendationId: "gov",
        axisName: "Governança",
        sectionName: "Ética",
        questionPrompt: longText,
        recommendationText: longText,
        plans: [makeAction({ id: "g1", progressPercentage: 100, status: "completed" })],
      }),
      makeSource({
        recommendationId: "env",
        axisName: "Ambiental",
        sectionName: "Resíduos",
        sectionOrder: 1,
        questionPrompt: longText,
        recommendationText: longText,
      }),
      makeSource({
        recommendationId: "soc",
        axisName: "Social",
        sectionName: "Pessoas",
        questionPrompt: longText,
        recommendationText: longText,
        plans: [
          makeAction({ id: "s1" }),
          makeAction({ id: "s2", startDate: "2026-10-01", dueDate: "2026-12-01" }),
        ],
      }),
    ]);

    const result = await buildRecommendationPortfolioPdf(rows);
    const pdf = await PDFDocument.load(result.content);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it("reserva espaço da mensagem de ações dentro do card", async () => {
    const ctx = await createBasicPdfTextContext();
    const rows = buildRecommendationPortfolioExportRows([
      makeSource({ recommendationId: "rec-empty" }),
    ]);
    const recommendation = {
      questionText: rows[0]!.questionText,
      recommendationText: rows[0]!.recommendationText,
      recommendationStatus: rows[0]!.recommendationStatus,
      actions: [],
    };
    const minHeight = measureRecommendationCardMinHeight(ctx, recommendation);
    expect(minHeight).toBeGreaterThan(PORTFOLIO_PDF_SPACE.cardPad * 2 + 40);
  });

  it("no portfólio, o card não reserva espaço da tabela de ações", async () => {
    const ctx = await createBasicPdfTextContext();
    const rows = buildRecommendationPortfolioExportRows([
      makeSource({
        recommendationId: "rec-with-actions",
        plans: [makeAction({ id: "a1" })],
      }),
    ]);
    const recommendation =
      buildRecommendationPortfolioExportDocument(rows).contexts[0]!.axes[0]!.sections[0]!
        .recommendations[0]!;
    const withoutActions = measureRecommendationCardMinHeight(
      ctx,
      recommendation,
      PORTFOLIO_PDF_CARD_OPTIONS,
    );
    const withActions = measureRecommendationCardMinHeight(ctx, recommendation);
    expect(withoutActions).toBeLessThan(withActions);
  });

  it("monta o bloco de contexto do plano de integridade e compliance sem versão", () => {
    expect(
      actionPlanPdfContextFields(
        {
          formName: "Diagnóstico de Integridade 2026",
          formVersion: "1",
          period: "2026",
          organizationName: "Corpo de Bombeiros Militar do RN",
          axes: [],
        },
        "14/08/2026",
      ),
    ).toEqual({
      left: [
        ["Formulário", "Diagnóstico de Integridade 2026"],
        ["Órgão", "Corpo de Bombeiros Militar do RN"],
      ],
      right: [
        ["Ciclo", "2026"],
        ["Data de emissão", "14/08/2026"],
      ],
    });
  });

  it("usa as cores canônicas dos eixos", () => {
    expect(portfolioAxisBarColor("Governança")).toEqual(hexToPdfRgb(getAxisTheme("Governança").primary));
    expect(portfolioAxisBarColor("Ambiental")).toEqual(hexToPdfRgb(getAxisTheme("Ambiental").primary));
    expect(portfolioAxisBarColor("Social")).toEqual(hexToPdfRgb(getAxisTheme("Social").primary));
  });

  it("mantém ritmo vertical entre pergunta, recomendação e seções", () => {
    expect(PORTFOLIO_PDF_SPACE.afterQuestion).toBeGreaterThanOrEqual(12);
    expect(PORTFOLIO_PDF_SPACE.afterSection).toBeGreaterThanOrEqual(12);
    expect(PORTFOLIO_PDF_SPACE.afterRecommendation).toBeGreaterThanOrEqual(8);
    expect(PORTFOLIO_PDF_SPACE.afterStatus).toBeGreaterThanOrEqual(10);
    expect(PORTFOLIO_PDF_SPACE.betweenRecommendations).toBeGreaterThanOrEqual(16);
    expect(PORTFOLIO_PDF_SPACE.contextInner).toBeGreaterThanOrEqual(12);
    expect(PORTFOLIO_PDF_SPACE.cardPad).toBeGreaterThanOrEqual(12);
  });
});
