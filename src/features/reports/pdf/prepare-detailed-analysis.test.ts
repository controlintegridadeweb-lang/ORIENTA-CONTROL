import { describe, expect, it } from "vitest";
import type { OfficialReportData } from "./report-types";
import {
  flattenDetailedAnalysisIds,
  prepareDetailedAnalysis,
  REPORT_EMPTY_ACTION_MOVEMENTS,
  REPORT_EMPTY_RECOMMENDATION_ACTIONS,
  REPORT_EMPTY_SECTION_RECOMMENDATIONS,
} from "./prepare-detailed-analysis";

function basePayload(over: Partial<OfficialReportData> = {}): OfficialReportData {
  return {
    cycleId: "cycle-1",
    cycleProcessingId: "processing-1",
    organizationId: "org-1",
    formId: "form-1",
    organizationName: "Organização",
    formName: "Diagnóstico",
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
    document: null,
    actionPlan: {
      cycleId: "cycle-1",
      formId: "form-1",
      formName: "Diagnóstico",
      formVersion: 1,
      organizationId: "org-1",
      organizationName: "Organização",
      axes: [],
      summary: {
        totalRecommendations: 0,
        recommendationsWithActions: 0,
        totalActions: 0,
        actionsByStatus: {},
      },
    },
    diagnostic: {
      criteria: [],
      summary: {
        total: 0,
        evaluated: 0,
        attended: 0,
        notAttended: 0,
        insufficientEvidence: 0,
        notApplicable: 0,
        waived: 0,
      },
      byAxis: [],
    },
    fami: {
      global: {
        percentage: 40,
        maturityLevel: 2,
        pointsObtained: 4,
        pointsPossible: 10,
      },
      byAxis: [
        {
          axisId: "ambient",
          axisName: "Ambiental",
          percentage: 30,
          maturityLevel: 2,
          pointsObtained: 1,
          pointsPossible: 3,
        },
        {
          axisId: "gov",
          axisName: "Governanca",
          percentage: 50,
          maturityLevel: 3,
          pointsObtained: 2,
          pointsPossible: 4,
        },
        {
          axisId: "social",
          axisName: "Social",
          percentage: 20,
          maturityLevel: 1,
          pointsObtained: 1,
          pointsPossible: 3,
        },
      ],
      sections: [
        {
          sectionId: "plan",
          sectionName: "Planejamento Organizacional",
          axisId: "gov",
          percentage: 50,
          maturityLevel: 3,
          pointsObtained: 1,
          pointsPossible: 2,
        },
        {
          sectionId: "integridade",
          sectionName: "Integridade",
          axisId: "gov",
          percentage: 0,
          maturityLevel: 1,
          pointsObtained: 0,
          pointsPossible: 2,
        },
      ],
    },
    actionMovementsByActionId: {},
    evidence: { total: 0, approved: 0, pending: 0, rejected: 0, complementation: 0 },
    evolution: [],
    criticalAxesCount: 2,
    advancedAxesCount: 0,
    topOpportunityAxis: "Social",
    meta: {
      applicableQuestions: 4,
      waivedQuestions: 0,
      notApplicableResponses: 0,
      isOfficialScore: true,
      cycleState: "completed",
      closedAt: "2026-07-20T12:00:00.000Z",
      responseDeadlineAt: null,
    },
    ...over,
  };
}

describe("prepareDetailedAnalysis", () => {
  it("ordena eixos e seções pela ordem oficial e mantém vínculos corretos", () => {
    const payload = basePayload({
      diagnostic: {
        criteria: [
          {
            questionVersionId: "qv-2",
            axisId: "gov",
            axisName: "Governanca",
            sectionId: "integridade",
            sectionName: "Integridade",
            sectionOrder: 2,
            orderIndex: 2,
            prompt: "Critério de integridade?",
            answer: "yes",
            requiresEvidence: true,
            evidenceCount: 0,
            evidenceStatus: "missing",
            evidenceJustifications: [],
            result: "insufficient_evidence",
            notApplicableJustification: null,
            notApplicableRejectionReason: null,
          },
          {
            questionVersionId: "qv-1",
            axisId: "gov",
            axisName: "Governanca",
            sectionId: "plan",
            sectionName: "Planejamento Organizacional",
            sectionOrder: 1,
            orderIndex: 1,
            prompt: "Há planejamento formal?",
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
            orderIndex: 1,
            prompt: "Há gestão de resíduos?",
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
          total: 3,
          evaluated: 3,
          attended: 1,
          notAttended: 1,
          insufficientEvidence: 1,
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
            notAttended: 1,
            insufficientEvidence: 1,
            notApplicable: 0,
            waived: 0,
          },
          {
            axisId: "ambient",
            axisName: "Ambiental",
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
                recommendationId: "rec-b",
                recommendationText: "Segunda recomendação",
                recommendationType: "evidencia_insuficiente",
                recommendationStatus: "generated",
                questionPrompt: "Critério de integridade?",
                sectionName: "Integridade",
                actions: [],
              },
              {
                recommendationId: "rec-a",
                recommendationText: "Primeira recomendação",
                recommendationType: "nao_implementacao",
                recommendationStatus: "in_action_plan",
                questionPrompt: "Há planejamento formal?",
                sectionName: "Planejamento Organizacional",
                actions: [
                  {
                    id: "action-2",
                    actionText: "Ação posterior",
                    startDate: "2026-10-01",
                    dueDate: "2026-12-01",
                    responsibleSector: "Planejamento",
                    responsibleUserId: null,
                    responsibleName: "Ana",
                    progressPercentage: 70,
                    status: "in_progress",
                    observations: null,
                    updatedAt: "2026-07-22T12:00:00.000Z",
                    revision: 1,
                    documents: [],
                    slaLabel: "ok",
                  },
                  {
                    id: "action-1",
                    actionText: "Ação anterior",
                    startDate: "2026-09-01",
                    dueDate: "2026-11-01",
                    responsibleSector: "Planejamento",
                    responsibleUserId: null,
                    responsibleName: "Ana",
                    progressPercentage: 30,
                    status: "in_progress",
                    observations: null,
                    updatedAt: "2026-07-21T12:00:00.000Z",
                    revision: 1,
                    documents: [],
                    slaLabel: "overdue",
                  },
                ],
              },
            ],
          },
        ],
        summary: {
          totalRecommendations: 2,
          recommendationsWithActions: 1,
          totalActions: 2,
          actionsByStatus: { in_progress: 2 },
        },
      },
      actionMovementsByActionId: {
        "action-1": [
          {
            id: "mov-2",
            actionPlanId: "action-1",
            previousPercentage: 10,
            newPercentage: 30,
            description: "Segunda atualização",
            createdAt: "2026-07-21T15:00:00.000Z",
            responsibleLabel: "Ana",
          },
          {
            id: "mov-1",
            actionPlanId: "action-1",
            previousPercentage: 0,
            newPercentage: 10,
            description: "Primeira atualização",
            createdAt: "2026-07-21T10:00:00.000Z",
            responsibleLabel: "Ana",
          },
          {
            id: "mov-1",
            actionPlanId: "action-1",
            previousPercentage: 0,
            newPercentage: 10,
            description: "duplicata",
            createdAt: "2026-07-21T10:00:00.000Z",
            responsibleLabel: "Ana",
          },
        ],
      },
    });

    const view = prepareDetailedAnalysis(payload);
    expect(view.axes.map((axis) => axis.title)).toEqual([
      "Governanca",
      "Ambiental",
      "Social",
    ]);
    expect(view.axes[0]?.numberLabel).toBe("5.1");
    expect(view.axes[0]?.sections.map((section) => section.title)).toEqual([
      "Planejamento Organizacional",
      "Integridade",
    ]);

    const planning = view.axes[0]?.sections[0];
    expect(planning?.numberLabel).toBe("5.1.1");
    expect(planning?.recommendations).toHaveLength(1);
    expect(planning?.recommendations[0]?.originCriterion).toBe("Há planejamento formal?");
    expect(planning?.recommendations[0]?.reasonLabel).toBe("Não implementado");
    expect(planning?.recommendations[0]?.numberLabel).toBe("5.1.1.1");
    expect(planning?.actionPlan.actions.map((action) => action.id)).toEqual([
      "action-1",
      "action-2",
    ]);
    expect(planning?.actionPlan.actions[0]?.numberLabel).toBe("5.1.1-A1");
    expect(planning?.actionPlan.actions[0]?.originRecommendationNumberLabel).toBe("5.1.1.1");
    expect(planning?.actionPlan.actions[0]?.isOverdue).toBe(true);
    expect(planning?.actionPlan.actions[0]?.movements.map((m) => m.id)).toEqual([
      "mov-1",
      "mov-2",
    ]);
    expect(planning?.actionPlan.actions[0]?.movements[0]?.progressLabel).toBe(
      "0% -> 10%",
    );
    expect(planning?.actionPlan.summary).toMatchObject({
      totalActions: 2,
      inProgressActions: 2,
      progressPercentage: 50,
      statusLabel: "Requer atenção",
    });

    const integrity = view.axes[0]?.sections[1];
    expect(integrity?.recommendations[0]?.id).toBe("rec-b");
    expect(integrity?.actionPlan.actions).toHaveLength(0);
    expect(integrity?.recommendations[0]?.statusLabel).toBe("Aguardando cadastro de ações");

    const ambiental = view.axes[1];
    expect(ambiental?.sections[0]?.recommendations).toHaveLength(0);
    expect(planning?.actionPlan.actions[1]?.movements).toHaveLength(0);
    expect(REPORT_EMPTY_SECTION_RECOMMENDATIONS).toContain("Nenhuma recomendação");
    expect(REPORT_EMPTY_RECOMMENDATION_ACTIONS).toContain("Ainda não há ações");
    expect(REPORT_EMPTY_ACTION_MOVEMENTS).toContain("Nenhuma movimentação");

    const flat = flattenDetailedAnalysisIds(view);
    expect(new Set(flat.recommendationIds).size).toBe(flat.recommendationIds.length);
    expect(new Set(flat.actionIds).size).toBe(flat.actionIds.length);
    expect(new Set(flat.movementIds).size).toBe(flat.movementIds.length);
    expect(flat.numberLabels).toContain("5.1.1-A1");
    expect(flat.numberLabels).toContain("5.1.1-A2");
  });

  it("não altera os percentuais oficiais do FAMI ao montar a análise", () => {
    const payload = basePayload();
    const before = structuredClone(payload.fami);
    prepareDetailedAnalysis(payload);
    expect(payload.fami).toEqual(before);
    expect(payload.fami.global.percentage).toBe(40);
    expect(payload.fami.byAxis.map((axis) => axis.percentage)).toEqual([30, 50, 20]);
  });
});
