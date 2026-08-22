import { describe, expect, it } from "vitest";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { computeActionSla } from "@/features/improvement-management/action-plans/domain-model";
import {
  buildRecommendationPortfolioExportRows,
  civilDateFromIso,
} from "./build-portfolio-export-rows";
import type { RecommendationPortfolioExportSource } from "./portfolio-export-types";
import { RECOMMENDATION_PORTFOLIO_EXPORT_HEADERS } from "./portfolio-export-types";
import {
  buildRecommendationPortfolioCsv,
  portfolioExportRowToCsvCells,
} from "./portfolio-export-csv";
import { buildRecommendationPortfolioXlsxSheets } from "./portfolio-export-xlsx-sheets";

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
    periodLabel: "2026",
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

describe("buildRecommendationPortfolioExportRows", () => {
  it("mantém recomendação sem ações com campos de execução nulos", () => {
    const rows = buildRecommendationPortfolioExportRows([
      makeSource({ recommendationId: "rec-empty" }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.actionTitle).toBeNull();
    expect(rows[0]?.responsibleName).toBeNull();
    expect(rows[0]?.startDate).toBeNull();
    expect(rows[0]?.endDate).toBeNull();
    expect(rows[0]?.actionStatus).toBeNull();
    expect(rows[0]?.progress).toBeNull();
    expect(rows[0]?.progressPercent).toBeNull();
    expect(rows[0]?.updatedAt).toBeNull();
    expect(rows[0]?.recommendationStatus).toBe("Gerada");
  });

  it("gera uma linha por ação com responsáveis, início e final distintos", () => {
    const rows = buildRecommendationPortfolioExportRows([
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
            status: "in_progress",
          }),
          makeAction({
            id: "a-early",
            actionText: "Ação A",
            startDate: "2026-09-01",
            dueDate: "2026-10-30",
            responsibleName: "Responsável A",
            progressPercentage: 50,
            status: "in_progress",
          }),
        ],
      }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.actionTitle)).toEqual(["Ação A", "Ação B"]);
    expect(rows.map((row) => row.responsibleName)).toEqual([
      "Responsável A",
      "Responsável B",
    ]);
    expect(rows[0]?.startDate?.toISOString().slice(0, 10)).toBe("2026-09-01");
    expect(rows[0]?.endDate?.toISOString().slice(0, 10)).toBe("2026-10-30");
    expect(rows[1]?.startDate?.toISOString().slice(0, 10)).toBe("2026-11-01");
    expect(rows[1]?.endDate?.toISOString().slice(0, 10)).toBe("2026-12-15");
    expect(rows[0]?.progressPercent).toBe(50);
    expect(rows[0]?.progress).toBe(0.5);
    expect(rows[1]?.progressPercent).toBe(20);
  });

  it("ordena por eixo e seção oficiais, não alfabeticamente", () => {
    const rows = buildRecommendationPortfolioExportRows([
      makeSource({
        recommendationId: "rec-social",
        axisName: "Social",
        sectionName: "Diversidade",
        sectionOrder: 1,
        questionOrder: 1,
      }),
      makeSource({
        recommendationId: "rec-env",
        axisName: "Ambiental",
        sectionName: "Resíduos",
        sectionOrder: 2,
        questionOrder: 1,
      }),
      makeSource({
        recommendationId: "rec-gov-2",
        axisName: "Governança",
        sectionName: "Transparência",
        sectionOrder: 2,
        questionOrder: 1,
      }),
      makeSource({
        recommendationId: "rec-gov-1",
        axisName: "Governança",
        sectionName: "Ética",
        sectionOrder: 1,
        questionOrder: 2,
      }),
    ]);

    expect(rows.map((row) => `${row.axisName}|${row.sectionName}`)).toEqual([
      "Governança|Ética",
      "Governança|Transparência",
      "Ambiental|Resíduos",
      "Social|Diversidade",
    ]);
  });

  it("não atribui responsável, início, final nem progresso à recomendação sem ação", () => {
    const rows = buildRecommendationPortfolioExportRows([
      makeSource({
        recommendationId: "rec-1",
        plans: [
          makeAction({
            id: "only",
            responsibleName: "Só da ação",
            dueDate: "2026-05-01",
            progressPercentage: 10,
          }),
        ],
      }),
      makeSource({ recommendationId: "rec-2", plans: [] }),
    ]);

    const withoutAction = rows.find((row) => row.sort.recommendationId === "rec-2");
    expect(withoutAction?.responsibleName).toBeNull();
    expect(withoutAction?.startDate).toBeNull();
    expect(withoutAction?.endDate).toBeNull();
    expect(withoutAction?.progressPercent).toBeNull();
  });
});

describe("civilDateFromIso", () => {
  it("formata datas civis sem deslocar o dia", () => {
    const date = civilDateFromIso("2026-11-30");
    expect(date).not.toBeNull();
    expect(date!.getUTCFullYear()).toBe(2026);
    expect(date!.getUTCMonth()).toBe(10);
    expect(date!.getUTCDate()).toBe(30);
    expect(civilDateFromIso("invalid")).toBeNull();
    expect(civilDateFromIso(null)).toBeNull();
  });
});

describe("portfolio CSV/XLSX contract", () => {
  it("usa cabeçalhos pt-BR na ordem canônica", () => {
    const rows = buildRecommendationPortfolioExportRows([
      makeSource({ recommendationId: "rec-1" }),
    ]);
    const csv = buildRecommendationPortfolioCsv(rows);
    const headerLine = csv.content.replace(/^\uFEFF/, "").split(/\r?\n/)[0] ?? "";

    expect(headerLine.split(";")).toEqual([...RECOMMENDATION_PORTFOLIO_EXPORT_HEADERS]);
    expect(headerLine).not.toContain("recommendationStatus");
    expect(headerLine).not.toContain("action_plans");
  });

  it("serializa progresso e datas sem concatenar ações", () => {
    const rows = buildRecommendationPortfolioExportRows([
      makeSource({
        recommendationId: "rec-1",
        plans: [
          makeAction({ id: "a1", actionText: "Ação 1", dueDate: "2026-01-15", progressPercentage: 40 }),
          makeAction({ id: "a2", actionText: "Ação 2", dueDate: "2026-02-20", progressPercentage: 80 }),
        ],
      }),
    ]);

    const cells = rows.map(portfolioExportRowToCsvCells);
    expect(cells).toHaveLength(2);
    expect(cells[0]?.[9]).toBe("Ação 1");
    expect(cells[1]?.[9]).toBe("Ação 2");
    expect(cells[0]?.[13]).toBe("Em andamento");
    expect(cells[0]?.[14]).toBe(40);
    expect(String(cells[0]?.[11])).toMatch(/01/);
    expect(String(cells[0]?.[12])).toMatch(/15/);
  });

  it("monta planilha com cabeçalho congelado e células tipadas", () => {
    const rows = buildRecommendationPortfolioExportRows([
      makeSource({
        recommendationId: "rec-1",
        plans: [makeAction({ id: "a1", progressPercentage: 40, dueDate: "2026-11-30" })],
      }),
    ]);
    const sheets = buildRecommendationPortfolioXlsxSheets(rows);
    const sheet = sheets[0];
    expect(sheet?.stickyRowsCount).toBe(1);
    expect(sheet?.data?.[0]).toHaveLength(RECOMMENDATION_PORTFOLIO_EXPORT_HEADERS.length);

    const dataRow = sheet?.data?.[1] as Array<unknown>;
    const startCell = dataRow[11] as { value: Date; format: string };
    const endCell = dataRow[12] as { value: Date; format: string };
    const progressCell = dataRow[14] as { value: number; format: string };
    expect(startCell.format).toBe("dd/mm/yyyy");
    expect(endCell.format).toBe("dd/mm/yyyy");
    expect(progressCell.value).toBe(0.4);
    expect(progressCell.format).toBe("0%");

    const questionCell = dataRow[6] as { wrap: boolean };
    const recommendationCell = dataRow[7] as { wrap: boolean };
    const actionCell = dataRow[9] as { wrap: boolean };
    expect(questionCell.wrap).toBe(true);
    expect(recommendationCell.wrap).toBe(true);
    expect(actionCell.wrap).toBe(true);
  });
});
