import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import type { OfficialReportData } from "../report-types";
import {
  buildOfficialReportPdfDocument,
  OFFICIAL_REPORT_SECTION_ORDER,
  TRACKING_REPORT_SECTION_ORDER,
} from "./build-official-report";
import { buildReportDiagnostic } from "../cycle-report-read";
import {
  flattenDetailedAnalysisIds,
  prepareDetailedAnalysis,
} from "../prepare-detailed-analysis";

describe("relatório oficial", () => {
  it("mantém a sequência do modelo institucional com hierarquia por eixo", () => {
    expect(OFFICIAL_REPORT_SECTION_ORDER).toEqual([
      "fami_summary",
      "diagnostic_summary",
      "detailed_axis_analysis",
      "conclusion",
      "metadata_audit",
    ]);
    expect(TRACKING_REPORT_SECTION_ORDER).not.toContain("fami_summary");
  });

  it("classifica cada critério com base no snapshot histórico", () => {
    const question = (id: string, answer: "yes" | "no" | "not_applicable", required: boolean) => ({
      question_version_id: id,
      answer,
      is_not_applicable: answer === "not_applicable",
      na_justification: answer === "not_applicable" ? "Justificativa institucional válida." : null,
      na_original_justification: answer === "not_applicable" ? "Justificativa institucional válida." : null,
      na_rejection_reason: null,
      question_versions: {
        axis_id: "gov",
        axis_name: "Governanca",
        section_id: "integridade",
        section_name: "Integridade",
        section_order: 1,
        prompt: `Pergunta ${id}`,
        evidence_parameter: { required },
        fami_enabled: true,
        applies_to_respondent: true,
      },
    });

    const rows = [
      question("q1", "yes", false),
      question("q2", "no", false),
      question("q3", "yes", true),
      question("q4", "yes", true),
      question("q5", "not_applicable", false),
    ];
    const result = buildReportDiagnostic({
      questions: rows.map((row, index) => ({
        question_version_id: row.question_version_id,
        order_index: index,
        question_versions: row.question_versions,
      })),
      responses: rows.map(({ question_versions: _questionVersions, ...response }) => response),
      evidences: [
        { question_version_id: "q3", validation_status: "invalidated", validation_justification: "Documento insuficiente." },
        { question_version_id: "q4", validation_status: "approved", validation_justification: null },
      ],
      waivedQuestionVersionIds: new Set(),
    });

    expect(result.criteria.map((criterion) => criterion.result)).toEqual([
      "attended",
      "not_attended",
      "insufficient_evidence",
      "attended",
      "not_applicable",
    ]);
    expect(result.summary).toEqual({
      total: 5,
      evaluated: 5,
      attended: 2,
      notAttended: 1,
      insufficientEvidence: 1,
      notApplicable: 1,
      waived: 0,
    });
  });

  it("gera o PDF completo com hierarquia linear e identificação da emissão", async () => {
    const longCriterion =
      "A organização possui procedimento institucional formalizado com registro, responsáveis, critérios de verificação e trilha documental auditável para cada ciclo de revisão. ".repeat(8);
    const longRecommendation =
      "Implantar o procedimento institucional recomendado com registro, responsáveis e critérios de verificação. ".repeat(35);
    const longAction =
      "Elaborar, revisar e aprovar o procedimento institucional com participação das áreas responsáveis. ".repeat(40);

    const payload: OfficialReportData = {
      cycleId: "cycle-1",
      cycleProcessingId: "processing-1",
      organizationId: "org-1",
      formId: "form-1",
      organizationName: "Organização de teste",
      formName: "Diagnóstico de teste",
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
        contentSha256: "a".repeat(64),
      },
      actionPlan: {
        cycleId: "cycle-1",
        formId: "form-1",
        formName: "Diagnóstico de teste",
        formVersion: 1,
        organizationId: "org-1",
        organizationName: "Organização de teste",
        axes: [{
          axisId: "gov",
          axisName: "Governanca",
          recommendations: [{
            recommendationId: "rec-1",
            recommendationText: longRecommendation,
            recommendationType: "nao_implementacao",
            recommendationStatus: "in_action_plan",
            questionPrompt: longCriterion.trim(),
            sectionName: "Integridade",
            actions: [{
              id: "action-1",
              actionText: longAction,
              startDate: "2026-09-01",
              dueDate: "2026-12-15",
              responsibleSector: "Integridade",
              responsibleUserId: "55555555-5555-4555-8555-555555555555",
              responsibleName: "Responsável",
              progressPercentage: 40,
              status: "in_progress",
              observations: "A execução deverá manter evidências das deliberações, versões aprovadas e comunicações internas. ".repeat(35),
              updatedAt: "2026-07-21T12:00:00.000Z",
              revision: 1,
              documents: [],
              slaLabel: "ok",
            }],
          }],
        }],
        summary: {
          totalRecommendations: 1,
          recommendationsWithActions: 1,
          totalActions: 1,
          actionsByStatus: { in_progress: 1 },
        },
      },
      diagnostic: {
        criteria: [{
          questionVersionId: "qv-1",
          axisId: "gov",
          axisName: "Governanca",
          sectionId: "integridade",
          sectionName: "Integridade",
          sectionOrder: 1,
          orderIndex: 0,
          prompt: longCriterion.trim(),
          answer: "no",
          requiresEvidence: false,
          evidenceCount: 0,
          evidenceStatus: "not_required",
          evidenceJustifications: [],
          result: "not_attended",
          notApplicableJustification: null,
          notApplicableRejectionReason: null,
        }],
        summary: {
          total: 1,
          evaluated: 1,
          attended: 0,
          notAttended: 1,
          insufficientEvidence: 0,
          notApplicable: 0,
          waived: 0,
        },
        byAxis: [{
          axisId: "gov",
          axisName: "Governanca",
          total: 1,
          evaluated: 1,
          attended: 0,
          notAttended: 1,
          insufficientEvidence: 0,
          notApplicable: 0,
          waived: 0,
        }],
      },
      fami: {
        global: {
          percentage: 50,
          maturityLevel: 3,
          pointsObtained: 5,
          pointsPossible: 10,
        },
        byAxis: [{
          axisId: "gov",
          axisName: "Governanca",
          percentage: 50,
          maturityLevel: 3,
          pointsObtained: 5,
          pointsPossible: 10,
        }],
        sections: [{
          sectionId: "integridade",
          sectionName: "Integridade",
          axisId: "gov",
          percentage: 50,
          maturityLevel: 3,
          pointsObtained: 5,
          pointsPossible: 10,
        }],
      },
      actionMovementsByActionId: {
        "action-1": [
          {
            id: "mov-1",
            actionPlanId: "action-1",
            previousPercentage: 0,
            newPercentage: 40,
            description: "Atualização inicial do progresso com detalhes suficientes para leitura no PDF institucional.",
            createdAt: "2026-07-21T08:00:00.000Z",
            responsibleLabel: "Responsável",
          },
        ],
      },
      evidence: { total: 0, approved: 0, pending: 0, rejected: 0, complementation: 0 },
      evolution: [],
      criticalAxesCount: 0,
      advancedAxesCount: 0,
      topOpportunityAxis: "Governanca",
      meta: {
        applicableQuestions: 1,
        waivedQuestions: 0,
        notApplicableResponses: 0,
        isOfficialScore: true,
        cycleState: "completed",
        closedAt: "2026-07-20T12:00:00.000Z",
        responseDeadlineAt: "2026-07-01T12:00:00.000Z",
      },
    };

    const famiBefore = structuredClone(payload.fami);
    const analysis = prepareDetailedAnalysis(payload);
    const flat = flattenDetailedAnalysisIds(analysis);
    expect(analysis.axes[0]?.sections[0]?.recommendations[0]?.originCriterion).toBe(
      longCriterion.trim(),
    );
    expect(analysis.axes[0]?.sections[0]?.recommendations[0]?.actions[0]?.id).toBe(
      "action-1",
    );
    expect(analysis.axes[0]?.sections[0]?.actionPlan.actions[0]?.id).toBe("action-1");
    expect(analysis.axes[0]?.sections[0]?.actionPlan.actions[0]?.movements[0]?.id).toBe(
      "mov-1",
    );
    expect(flat.recommendationIds).toEqual(["rec-1"]);
    expect(payload.fami).toEqual(famiBefore);

    const bytes = await buildOfficialReportPdfDocument(payload);
    const pdf = await PDFDocument.load(bytes);

    expect(bytes.length).toBeGreaterThan(1_000);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(8);
    expect(payload.document?.contentSha256).toHaveLength(64);
  });
});
