import { describe, expect, it } from "vitest";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { computeActionSla } from "@/features/improvement-management/action-plans/domain-model";
import type { AdminPlanItem } from "@/features/improvement-management/action-plans/admin-monitoring";
import type { RecommendationPortfolioExportSource } from "@/features/improvement-management/recommendations/export/portfolio-export-types";
import { PORTFOLIO_EXPORT_MISSING_VALUE } from "@/features/improvement-management/recommendations/export/portfolio-export-types";
import {
  getActionPlanExportData,
  toActionPlanExportSourceFromAdmin,
} from "./get-action-plan-export-data";
import { ACTION_PLAN_EXPORT_HEADERS } from "./action-plan-export-types";
import {
  actionPlanExportRowToExcelCells,
  buildActionPlanXlsxSheets,
} from "./action-plan-export-xlsx-sheets";
import { generateActionPlanPdf } from "./action-plan-export-pdf";
import { generateActionPlanExcel } from "./action-plan-export-xlsx";
import { PDFDocument } from "pdf-lib";

function makeAction(
  over: Partial<Omit<ActionPlanAction, "slaLabel">> & Pick<ActionPlanAction, "id">,
): ActionPlanAction {
  const base = {
    actionText: "Ação padrão",
    startDate: "2026-03-10",
    dueDate: "2026-06-30",
    responsibleSector: "Integridade",
    responsibleUserId: "55555555-5555-4555-8555-555555555555",
    responsibleName: "Unidade de Integridade",
    progressPercentage: 45,
    status: "in_progress" as const,
    observations: null,
    updatedAt: "2026-05-12T12:00:00.000Z",
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
    organizationName: "Corpo de Bombeiros Militar do RN",
    axisName: "Governança",
    sectionName: "Governança e Estrutura de Integridade",
    sectionOrder: 1,
    questionOrder: 1,
    questionPrompt: "A organização publica informações no portal institucional?",
    recommendationText: "Publicar informações no portal institucional.",
    recommendationStatus: "in_action_plan",
    plans: [],
    ...over,
  };
}

function makeAdminItem(over: Partial<AdminPlanItem> = {}): AdminPlanItem {
  return {
    rowKey: "rec-1:plan-1",
    recommendationId: "rec-1",
    questionId: "question-1",
    planId: "plan-1",
    organizationId: "org-1",
    organizationName: "Corpo de Bombeiros Militar do RN",
    formId: "form-1",
    cycleId: "cycle-1",
    periodLabel: "2026",
    formName: "Diagnóstico de Integridade 2026",
    formVersion: 1,
    axisId: "11111111-1111-4111-8111-111111111111",
    axisName: "Governança",
    sectionId: "22222222-2222-4222-8222-222222222222",
    sectionName: "Governança e Estrutura de Integridade",
    sectionOrder: 1,
    questionOrder: 1,
    questionPrompt: "A organização publica informações no portal institucional?",
    recommendationText: "Publicar informações no portal institucional.",
    recommendationType: "negative_answer",
    recommendationStatus: "in_action_plan",
    actionText: "Publicar informações no portal institucional",
    planStatus: "in_progress",
    view: "in_progress",
    riskScore: 0,
    risk: "healthy",
    hasPlan: true,
    responsibleName: "Unidade X",
    responsibleSector: "Comunicação",
    startDate: "2026-03-10",
    dueDate: "2026-06-30",
    updatedAt: "2026-05-12T12:00:00.000Z",
    lastActivityLabel: "12/05/2026",
    isOverdue: false,
    isDueSoon: false,
    progress: 45,
    observations: null,
    totalActionsForRecommendation: 1,
    slaLabel: "ok",
    ...over,
  };
}

describe("getActionPlanExportData", () => {
  it("expande uma recomendação com várias ações em uma linha por ação", () => {
    const data = getActionPlanExportData(
      [
        makeSource({
          recommendationId: "rec-multi",
          plans: [
            makeAction({
              id: "a-late",
              actionText: "Revisar conteúdo publicado",
              startDate: "2026-07-01",
              dueDate: "2026-08-30",
              responsibleName: "Unidade Y",
              progressPercentage: 0,
              status: "not_started",
            }),
            makeAction({
              id: "a-early",
              actionText: "Publicar informações no portal institucional",
              startDate: "2026-03-10",
              dueDate: "2026-06-30",
              responsibleName: "Unidade X",
              progressPercentage: 45,
              status: "in_progress",
            }),
          ],
        }),
      ],
      "2026-08-14",
    );

    expect(data.rows).toHaveLength(2);
    expect(data.rows.map((row) => row.actionTitle)).toEqual([
      "Publicar informações no portal institucional",
      "Revisar conteúdo publicado",
    ]);
    expect(data.document.contexts[0]?.axes[0]?.sections[0]?.recommendations).toHaveLength(1);
    expect(
      data.document.contexts[0]?.axes[0]?.sections[0]?.recommendations[0]?.actions,
    ).toHaveLength(2);
    expect(data.issuedOn).toBe("2026-08-14");
  });

  it("descarta recomendações sem ações e não inventa histórico", () => {
    const data = getActionPlanExportData([
      makeSource({ recommendationId: "rec-empty", plans: [] }),
      makeSource({
        recommendationId: "rec-one",
        plans: [makeAction({ id: "only", progressPercentage: 0, status: "not_started" })],
      }),
    ]);

    expect(data.rows).toHaveLength(1);
    expect(data.rows[0]?.progressPercent).toBe(0);
    expect(data.rows[0]?.progress).toBe(0);
    expect(data.sources.every((source) => source.plans.length > 0)).toBe(true);
  });

  it("ordena por eixo e seção oficiais, não alfabeticamente", () => {
    const data = getActionPlanExportData([
      makeSource({
        recommendationId: "rec-social",
        axisName: "Social",
        sectionName: "Diversidade",
        sectionOrder: 1,
        plans: [makeAction({ id: "s1" })],
      }),
      makeSource({
        recommendationId: "rec-env",
        axisName: "Ambiental",
        sectionName: "Resíduos",
        sectionOrder: 2,
        plans: [makeAction({ id: "e1" })],
      }),
      makeSource({
        recommendationId: "rec-gov-2",
        axisName: "Governança",
        sectionName: "Transparência",
        sectionOrder: 2,
        plans: [makeAction({ id: "g2" })],
      }),
      makeSource({
        recommendationId: "rec-gov-1",
        axisName: "Governança",
        sectionName: "Ética",
        sectionOrder: 1,
        questionOrder: 2,
        plans: [makeAction({ id: "g1" })],
      }),
    ]);

    expect(data.rows.map((row) => `${row.axisName}|${row.sectionName}`)).toEqual([
      "Governança|Ética",
      "Governança|Transparência",
      "Ambiental|Resíduos",
      "Social|Diversidade",
    ]);
  });

  it("preserva progresso 0% e 100% e trata nulos como ausência", () => {
    const data = getActionPlanExportData([
      makeSource({
        recommendationId: "rec-zero",
        plans: [
          makeAction({
            id: "zero",
            progressPercentage: 0,
            status: "not_started",
            responsibleName: "",
            responsibleSector: "",
            startDate: "",
            dueDate: "",
          }),
        ],
      }),
      makeSource({
        recommendationId: "rec-done",
        questionOrder: 2,
        plans: [
          makeAction({
            id: "done",
            progressPercentage: 100,
            status: "completed",
          }),
        ],
      }),
      makeSource({
        recommendationId: "rec-cancel",
        questionOrder: 3,
        plans: [
          makeAction({
            id: "cancel",
            progressPercentage: 10,
            status: "cancelled",
          }),
        ],
      }),
    ]);

    expect(data.rows[0]?.progressPercent).toBe(0);
    expect(data.rows[0]?.progress).toBe(0);
    expect(data.rows[0]?.responsibleName).toBeNull();
    expect(data.rows[0]?.startDate).toBeNull();
    expect(data.rows[0]?.endDate).toBeNull();
    expect(data.rows[0]?.actionStatus).toBe("Não iniciado");
    expect(data.rows[1]?.progressPercent).toBe(100);
    expect(data.rows[1]?.progress).toBe(1);
    expect(data.rows[1]?.actionStatus).toBe("Concluída");
    expect(data.rows[2]?.actionStatus).toBe("Cancelado");

    const grouped = data.document.contexts[0]?.axes[0]?.sections[0]?.recommendations ?? [];
    expect(grouped[0]?.actions[0]?.responsible).toBe(PORTFOLIO_EXPORT_MISSING_VALUE);
    expect(grouped[0]?.actions[0]?.startDate).toBe(PORTFOLIO_EXPORT_MISSING_VALUE);
    expect(grouped[0]?.actions[0]?.progress).toBe("0%");
    expect(grouped[1]?.actions[0]?.progress).toBe("100%");
  });

  it("mapeia o item administrativo sem IDs internos na linha tabular", () => {
    const source = toActionPlanExportSourceFromAdmin(
      makeAdminItem({ planId: null, planStatus: null, hasPlan: false }),
    );
    expect(source).toBeNull();

    const mapped = toActionPlanExportSourceFromAdmin(makeAdminItem());
    expect(mapped?.plans).toHaveLength(1);
    const data = getActionPlanExportData(mapped ? [mapped] : []);
    const cells = actionPlanExportRowToExcelCells(data.rows[0]!);
    expect(JSON.stringify(cells)).not.toContain("rec-1");
    expect(JSON.stringify(cells)).not.toContain("plan-1");
  });
});

describe("Excel analítico do plano de integridade e compliance", () => {
  it("usa as 14 colunas canônicas, congela o cabeçalho e tipa datas e progresso", () => {
    const data = getActionPlanExportData([
      makeSource({
        recommendationId: "rec-1",
        plans: [
          makeAction({ id: "a1", progressPercentage: 0, startDate: "2026-03-10", dueDate: "2026-06-30" }),
          makeAction({
            id: "a2",
            actionText: "Revisar conteúdo publicado",
            startDate: "2026-07-01",
            dueDate: "2026-08-30",
            progressPercentage: 100,
            status: "completed",
          }),
        ],
      }),
    ]);
    const sheets = buildActionPlanXlsxSheets(data.rows);
    const sheet = sheets[0];
    expect(sheet?.stickyRowsCount).toBe(1);
    expect(sheet?.data?.[0]).toHaveLength(ACTION_PLAN_EXPORT_HEADERS.length);
    expect(ACTION_PLAN_EXPORT_HEADERS).toEqual([
      "Formulário",
      "Órgão",
      "Eixo",
      "Seção",
      "Ação",
      "Responsável",
      "Início",
      "Final",
      "Situação da ação",
      "Progresso",
      "Pergunta de origem",
      "Recomendação de origem",
      "Situação da recomendação",
      "Última atualização",
    ]);

    const first = sheet?.data?.[1] as Array<unknown>;
    const second = sheet?.data?.[2] as Array<unknown>;
    const startCell = first[6] as { value: Date; format: string };
    const progressZero = first[9] as { value: number; format: string };
    const progressDone = second[9] as { value: number; format: string };
    expect(startCell.format).toBe("dd/mm/yyyy");
    expect(progressZero.value).toBe(0);
    expect(progressZero.format).toBe("0%");
    expect(progressDone.value).toBe(1);

    const actionCell = first[4] as { wrap: boolean };
    const questionCell = first[10] as { wrap: boolean };
    const recommendationCell = first[11] as { wrap: boolean };
    expect(questionCell.wrap).toBe(true);
    expect(recommendationCell.wrap).toBe(true);
    expect(actionCell.wrap).toBe(true);
  });

  it("gera um arquivo xlsx válido", async () => {
    const data = getActionPlanExportData([
      makeSource({
        recommendationId: "rec-1",
        plans: [makeAction({ id: "a1" })],
      }),
    ]);
    const file = await generateActionPlanExcel(data);
    expect(file.filename).toMatch(/^plano-de-integridade-e-compliance-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(file.content.subarray(0, 2).toString()).toBe("PK");
  });
});

describe("PDF institucional do plano de integridade e compliance", () => {
  it("gera PDF com título institucional e não inclui recomendações sem ação", async () => {
    const data = getActionPlanExportData(
      [
        makeSource({ recommendationId: "rec-empty" }),
        makeSource({
          recommendationId: "rec-one",
          plans: [makeAction({ id: "only", progressPercentage: 0 })],
        }),
      ],
      "2026-08-14",
    );
    const empty = await generateActionPlanPdf(getActionPlanExportData([], "2026-08-14"));
    expect(empty.filename).toMatch(/^plano-de-integridade-e-compliance-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(Buffer.from(empty.content).subarray(0, 4).toString()).toBe("%PDF");

    const populated = await generateActionPlanPdf(data);
    const pdf = await PDFDocument.load(populated.content);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(populated.filename).toMatch(/^plano-de-integridade-e-compliance-\d{4}-\d{2}-\d{2}\.pdf$/);
    // Hierarquia institucional: contexto → eixo → seção → origem → ações.
    expect(data.document.contexts[0]?.axes[0]?.sections[0]?.recommendations).toHaveLength(1);
  });

  it("aceita textos longos, múltiplos eixos e quebra de página", async () => {
    const longText = "Texto institucional extenso sobre integridade pública. ".repeat(80);
    const data = getActionPlanExportData([
      makeSource({
        recommendationId: "gov",
        axisName: "Governança",
        questionPrompt: longText,
        recommendationText: longText,
        plans: [makeAction({ id: "g1", progressPercentage: 100, status: "completed" })],
      }),
      makeSource({
        recommendationId: "env",
        axisName: "Ambiental",
        sectionName: "Resíduos",
        questionPrompt: longText,
        recommendationText: longText,
        plans: [makeAction({ id: "e1", progressPercentage: 0, status: "not_started" })],
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

    const result = await generateActionPlanPdf(data);
    const pdf = await PDFDocument.load(result.content);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });
});
