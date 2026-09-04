import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import type { OfficialReportData } from "../report-types";
import {
  flattenDetailedAnalysisIds,
  prepareDetailedAnalysis,
  REPORT_EMPTY_RECOMMENDATION_ACTIONS,
} from "../prepare-detailed-analysis";
import { buildOfficialReportPdfDocument } from "./build-official-report";
import { OrientaPdfDocument } from "./document";
import {
  buildDiagnosticSummaryMetrics,
} from "./sections/diagnostic-summary-section";
import { formatReportPercentage, formatReportPoints } from "./formatters";
import { OFFICIAL_REPORT_COVER_FIELD_LABELS } from "./sections/cover-page";

function action(over: Partial<OfficialReportData["actionPlan"]["axes"][0]["recommendations"][0]["actions"][0]> & { id: string }) {
  return {
    actionText: over.actionText ?? `Ação ${over.id}`,
    startDate: over.startDate ?? "2026-01-01",
    dueDate: over.dueDate ?? "2026-12-31",
    responsibleSector: over.responsibleSector ?? "Área",
    responsibleUserId: over.responsibleUserId ?? null,
    responsibleName: over.responsibleName ?? "Responsável",
    progressPercentage: over.progressPercentage ?? 0,
    status: over.status ?? ("not_started" as const),
    observations: over.observations ?? null,
    updatedAt: over.updatedAt ?? "2026-07-21T12:00:00.000Z",
    revision: over.revision ?? 1,
    documents: over.documents ?? [],
    slaLabel: over.slaLabel ?? ("ok" as const),
    id: over.id,
  };
}

function buildFixture(over: Partial<OfficialReportData> = {}): OfficialReportData {
  return {
    cycleId: "cycle-1",
    cycleProcessingId: "processing-1",
    organizationId: "org-1",
    formId: "form-1",
    organizationName:
      "Secretaria Extraordinária de Desenvolvimento Institucional, Transparência e Controle Interno do Estado",
    formName: "Diagnóstico ESG — Maturidade Institucional",
    processingVersion: 1,
    policyVersion: "v1",
    referenceYear: 2026,
    referenceStartYear: 2026,
    referenceEndYear: 2026,
    referencePeriodLabel: "2026",
    actionPlanRevision: 0,
    periodLabel: "2026",
    famiProcessedAt: "2026-07-20T12:00:00.000Z",
    generatedAtIso: "2026-07-21T12:00:00.000Z",
    document: {
      reportId: "33333333-3333-4333-8333-333333333333",
      emissionVersion: 1,
      generatedByLabel: "Administração da plataforma",
      generatedAtIso: "2026-07-21T12:00:00.000Z",
      reissueReason: null,
      contentSha256: "b".repeat(64),
    },
    actionPlan: {
      cycleId: "cycle-1",
      formId: "form-1",
      formName: "Diagnóstico ESG — Maturidade Institucional",
      formVersion: 1,
      organizationId: "org-1",
      organizationName: "Organização",
      axes: [
        {
          axisId: "gov",
          axisName: "Governanca",
          recommendations: [
            {
              recommendationId: "rec-1",
              recommendationText: "Formalizar o comitê de integridade com ata e regimento.",
              recommendationType: "nao_implementacao",
              recommendationStatus: "in_action_plan",
              questionPrompt: "A organização possui comitê de integridade formalizado?",
              sectionName: "Integridade",
              actions: [
                action({
                  id: "action-1",
                  actionText: "Publicar portaria do comitê",
                  progressPercentage: 40,
                  status: "in_progress",
                  documents: [
                    {
                      id: "doc-1",
                      actionRevision: 1,
                      kind: "file",
                      title: "Minuta da portaria",
                      externalLink: null,
                      originalFilename: "portaria.pdf",
                      mimeType: "application/pdf",
                      sizeBytes: 1200,
                      fileValidationStatus: "valid",
                      validatedAt: "2026-07-20T12:00:00.000Z",
                      createdAt: "2026-07-20T12:00:00.000Z",
                      isCurrentRevision: true,
                    },
                  ],
                }),
                action({
                  id: "action-2",
                  actionText: "Registrar primeira reunião ordinária",
                  progressPercentage: 0,
                  status: "not_started",
                }),
              ],
            },
            {
              recommendationId: "rec-sem-acao",
              recommendationText: "Atualizar o código de conduta.",
              recommendationType: "nao_implementacao",
              recommendationStatus: "generated",
              questionPrompt: "O código de conduta está vigente e publicado?",
              sectionName: "Integridade",
              actions: [],
            },
          ],
        },
        {
          axisId: "ambient",
          axisName: "Ambiental",
          recommendations: [
            {
              recommendationId: "rec-amb",
              recommendationText: "Implantar coleta seletiva institucional.",
              recommendationType: "nao_implementacao",
              recommendationStatus: "in_action_plan",
              questionPrompt: "Há coleta seletiva em todas as unidades?",
              sectionName: "Resíduos",
              actions: [
                action({
                  id: "action-amb",
                  actionText: "Contratar fornecedor de coleta",
                  progressPercentage: 100,
                  status: "completed",
                }),
              ],
            },
          ],
        },
        {
          axisId: "social",
          axisName: "Social",
          recommendations: [],
        },
      ],
      summary: {
        totalRecommendations: 3,
        recommendationsWithActions: 2,
        totalActions: 3,
        actionsByStatus: { in_progress: 1, not_started: 1, completed: 1 },
      },
    },
    diagnostic: {
      criteria: [
        {
          questionVersionId: "qv-1",
          axisId: "gov",
          axisName: "Governanca",
          sectionId: "integridade",
          sectionName: "Integridade",
          sectionOrder: 1,
          orderIndex: 0,
          prompt: "A organização possui comitê de integridade formalizado?",
          answer: "no",
          requiresEvidence: false,
          evidenceCount: 0,
          evidenceStatus: "not_required",
          evidenceJustifications: [],
          result: "not_attended",
          notApplicableJustification: null,
          notApplicableRejectionReason: null,
        },
        {
          questionVersionId: "qv-2",
          axisId: "gov",
          axisName: "Governanca",
          sectionId: "integridade",
          sectionName: "Integridade",
          sectionOrder: 1,
          orderIndex: 1,
          prompt: "O código de conduta está vigente e publicado?",
          answer: "no",
          requiresEvidence: false,
          evidenceCount: 0,
          evidenceStatus: "not_required",
          evidenceJustifications: [],
          result: "not_attended",
          notApplicableJustification: null,
          notApplicableRejectionReason: null,
        },
        {
          questionVersionId: "qv-3",
          axisId: "ambient",
          axisName: "Ambiental",
          sectionId: "residuos",
          sectionName: "Resíduos",
          sectionOrder: 1,
          orderIndex: 0,
          prompt: "Há coleta seletiva em todas as unidades?",
          answer: "no",
          requiresEvidence: false,
          evidenceCount: 0,
          evidenceStatus: "not_required",
          evidenceJustifications: [],
          result: "not_attended",
          notApplicableJustification: null,
          notApplicableRejectionReason: null,
        },
        {
          questionVersionId: "qv-4",
          axisId: "social",
          axisName: "Social",
          sectionId: "diversidade",
          sectionName: "Diversidade",
          sectionOrder: 1,
          orderIndex: 0,
          prompt: "Há política de diversidade publicada?",
          answer: "yes",
          requiresEvidence: false,
          evidenceCount: 0,
          evidenceStatus: "not_required",
          evidenceJustifications: [],
          result: "attended",
          notApplicableJustification: null,
          notApplicableRejectionReason: null,
        },
      ],
      summary: {
        total: 4,
        evaluated: 4,
        attended: 1,
        notAttended: 3,
        insufficientEvidence: 0,
        notApplicable: 0,
        waived: 0,
      },
      byAxis: [
        {
          axisId: "gov",
          axisName: "Governanca",
          total: 2,
          evaluated: 2,
          attended: 0,
          notAttended: 2,
          insufficientEvidence: 0,
          notApplicable: 0,
          waived: 0,
        },
        {
          axisId: "ambient",
          axisName: "Ambiental",
          total: 1,
          evaluated: 1,
          attended: 0,
          notAttended: 1,
          insufficientEvidence: 0,
          notApplicable: 0,
          waived: 0,
        },
        {
          axisId: "social",
          axisName: "Social",
          total: 1,
          evaluated: 1,
          attended: 1,
          notAttended: 0,
          insufficientEvidence: 0,
          notApplicable: 0,
          waived: 0,
        },
      ],
    },
    fami: {
      global: {
        percentage: 70,
        maturityLevel: 3,
        pointsObtained: 7,
        pointsPossible: 10,
      },
      byAxis: [
        {
          axisId: "gov",
          axisName: "Governanca",
          percentage: 60,
          maturityLevel: 3,
          pointsObtained: 3,
          pointsPossible: 5,
        },
        {
          axisId: "ambient",
          axisName: "Ambiental",
          percentage: 50,
          maturityLevel: 3,
          pointsObtained: 2,
          pointsPossible: 4,
        },
        {
          axisId: "social",
          axisName: "Social",
          percentage: 90,
          maturityLevel: 5,
          pointsObtained: 2,
          pointsPossible: 1,
        },
      ],
      sections: [
        {
          sectionId: "integridade",
          sectionName: "Integridade",
          axisId: "gov",
          percentage: 60,
          maturityLevel: 3,
          pointsObtained: 3,
          pointsPossible: 5,
        },
        {
          sectionId: "residuos",
          sectionName: "Resíduos",
          axisId: "ambient",
          percentage: 50,
          maturityLevel: 3,
          pointsObtained: 2,
          pointsPossible: 4,
        },
        {
          sectionId: "diversidade",
          sectionName: "Diversidade",
          axisId: "social",
          percentage: 90,
          maturityLevel: 5,
          pointsObtained: 2,
          pointsPossible: 1,
        },
      ],
    },
    actionMovementsByActionId: {
      "action-1": [
        {
          id: "mov-1",
          actionPlanId: "action-1",
          previousPercentage: 0,
          newPercentage: 20,
          description: "Minuta elaborada e enviada para revisão jurídica.",
          createdAt: "2026-07-10T09:00:00.000Z",
          responsibleLabel: "Responsável",
        },
        {
          id: "mov-2",
          actionPlanId: "action-1",
          previousPercentage: 20,
          newPercentage: 40,
          description: "Ajustes incorporados após parecer.",
          createdAt: "2026-07-18T14:30:00.000Z",
          responsibleLabel: "Responsável",
        },
      ],
    },
    evidence: { total: 1, approved: 1, pending: 0, rejected: 0, complementation: 0 },
    evolution: [],
    criticalAxesCount: 0,
    advancedAxesCount: 1,
    topOpportunityAxis: "Ambiental",
    meta: {
      applicableQuestions: 4,
      waivedQuestions: 0,
      notApplicableResponses: 0,
      isOfficialScore: true,
      cycleState: "completed",
      closedAt: "2026-07-20T12:00:00.000Z",
      responseDeadlineAt: "2026-07-01T12:00:00.000Z",
    },
    ...over,
  };
}

describe("layout oficial do relatório", () => {
  it("preserva ordem Eixo → Seção → Pergunta e vínculos de ações/monitoramento", () => {
    const payload = buildFixture();
    const famiBefore = structuredClone(payload.fami);
    const view = prepareDetailedAnalysis(payload);

    expect(view.axes.map((axis) => axis.title)).toEqual([
      "Governanca",
      "Ambiental",
      "Social",
    ]);
    expect(view.axes[0]?.sections[0]?.title).toBe("Integridade");
    expect(view.axes[0]?.sections[0]?.recommendations[0]?.originCriterion).toContain(
      "comitê de integridade",
    );
    expect(view.axes[0]?.sections[0]?.recommendations[0]?.actions.map((a) => a.id)).toEqual([
      "action-1",
      "action-2",
    ]);
    expect(view.axes[0]?.sections[0]?.recommendations[1]?.actions).toHaveLength(0);
    expect(REPORT_EMPTY_RECOMMENDATION_ACTIONS).toContain("Nenhuma ação cadastrada");
    expect(view.axes[0]?.sections[0]?.recommendations[0]?.actions[0]?.movements.map((m) => m.id)).toEqual([
      "mov-1",
      "mov-2",
    ]);
    expect(view.axes[1]?.sections[0]?.recommendations[0]?.actions[0]?.movements).toHaveLength(0);
    expect(view.axes[2]?.sections[0]?.recommendations).toHaveLength(0);
    expect(payload.fami).toEqual(famiBefore);

    const flat = flattenDetailedAnalysisIds(view);
    expect(flat.recommendationIds).toEqual(["rec-1", "rec-sem-acao", "rec-amb"]);
    expect(flat.actionIds).toEqual(["action-1", "action-2", "action-amb"]);
  });

  it("calcula métricas do resumo sem reinterpretar regras de domínio", () => {
    const metrics = buildDiagnosticSummaryMetrics(buildFixture());
    expect(metrics).toEqual({
      evaluatedQuestions: 4,
      totalRecommendations: 3,
      evaluatedSections: 3,
      sectionsWithRecommendations: 2,
    });
  });

  it("formata percentuais, pontos e labels em pt-BR", () => {
    expect(formatReportPercentage(70)).toBe("70,0%");
    expect(formatReportPoints(6, 10)).toBe("6,00 / 10,00");
    expect(OFFICIAL_REPORT_COVER_FIELD_LABELS).toContain("Data de emissão");
  });

  it("embute logo, marca e decorações laterais da capa", async () => {
    const doc = await OrientaPdfDocument.create(buildFixture());
    expect(doc.logo.width).toBeGreaterThan(100);
    expect(doc.coverAssets.brandMark.width).toBeGreaterThan(100);
    expect(doc.coverAssets.decoTop.width).toBeGreaterThan(100);
    expect(doc.coverAssets.decoBottom.width).toBeGreaterThan(100);
  });

  it("gera PDF com eixos completos, textos longos e sem páginas vazias artificiais", async () => {
    const payload = buildFixture();
    const bytes = await buildOfficialReportPdfDocument(payload);
    const pdf = await PDFDocument.load(bytes);
    const pageCount = pdf.getPageCount();

    expect(bytes.length).toBeGreaterThan(5_000);
    expect(pageCount).toBeGreaterThanOrEqual(7);
    expect(pageCount).toBeLessThan(80);

    const { writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    writeFileSync(join(process.cwd(), "tmp-official-report-sample.pdf"), bytes);
  });

  it("gera PDF com apenas parte dos eixos aplicáveis", async () => {
    const payload = buildFixture({
      fami: {
        global: {
          percentage: 55,
          maturityLevel: 3,
          pointsObtained: 5,
          pointsPossible: 9,
        },
        byAxis: [
          {
            axisId: "gov",
            axisName: "Governanca",
            percentage: 55,
            maturityLevel: 3,
            pointsObtained: 5,
            pointsPossible: 9,
          },
        ],
        sections: [
          {
            sectionId: "integridade",
            sectionName: "Integridade",
            axisId: "gov",
            percentage: 55,
            maturityLevel: 3,
            pointsObtained: 5,
            pointsPossible: 9,
          },
        ],
      },
      actionPlan: {
        cycleId: "cycle-1",
        formId: "form-1",
        formName: "Diagnóstico",
        formVersion: 1,
        organizationId: "org-1",
        organizationName: "Organização",
        axes: [
          {
            axisId: "gov",
            axisName: "Governanca",
            recommendations: [
              {
                recommendationId: "rec-1",
                recommendationText: "Formalizar o comitê.",
                recommendationType: "nao_implementacao",
                recommendationStatus: "generated",
                questionPrompt: "A organização possui comitê de integridade formalizado?",
                sectionName: "Integridade",
                actions: [],
              },
            ],
          },
        ],
        summary: {
          totalRecommendations: 1,
          recommendationsWithActions: 0,
          totalActions: 0,
          actionsByStatus: {},
        },
      },
      diagnostic: {
        criteria: [
          {
            questionVersionId: "qv-1",
            axisId: "gov",
            axisName: "Governanca",
            sectionId: "integridade",
            sectionName: "Integridade",
            sectionOrder: 1,
            orderIndex: 0,
            prompt: "A organização possui comitê de integridade formalizado?",
            answer: "no",
            requiresEvidence: false,
            evidenceCount: 0,
            evidenceStatus: "not_required",
            evidenceJustifications: [],
            result: "not_attended",
            notApplicableJustification: null,
            notApplicableRejectionReason: null,
          },
        ],
        summary: {
          total: 1,
          evaluated: 1,
          attended: 0,
          notAttended: 1,
          insufficientEvidence: 0,
          notApplicable: 0,
          waived: 0,
        },
        byAxis: [
          {
            axisId: "gov",
            axisName: "Governanca",
            total: 1,
            evaluated: 1,
            attended: 0,
            notAttended: 1,
            insufficientEvidence: 0,
            notApplicable: 0,
            waived: 0,
          },
        ],
      },
    });

    const view = prepareDetailedAnalysis(payload);
    expect(view.axes.map((axis) => axis.title)).toEqual(["Governanca"]);
    const bytes = await buildOfficialReportPdfDocument(payload);
    expect(bytes.length).toBeGreaterThan(2_000);
  });
});
