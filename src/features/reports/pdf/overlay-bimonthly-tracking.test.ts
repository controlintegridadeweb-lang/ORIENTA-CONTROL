import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import type { OfficialReportData } from "./report-types";
import { buildOfficialReportPdfDocument } from "./pdf/build-official-report";
import {
  BIMONTHLY_TRACKING_DISCLAIMER,
  overlayBimonthlyTrackingOnOfficialReport,
  type BimonthlyTrackingSnapshot,
} from "./overlay-bimonthly-tracking";

function action(over: {
  id: string;
  actionText?: string;
  progressPercentage?: number;
  status?: "not_started" | "in_progress" | "completed" | "cancelled";
  documents?: OfficialReportData["actionPlan"]["axes"][0]["recommendations"][0]["actions"][0]["documents"];
}) {
  return {
    id: over.id,
    actionText: over.actionText ?? `Ação ${over.id}`,
    startDate: "2026-01-01",
    dueDate: "2026-12-31",
    responsibleSector: "Área",
    responsibleUserId: "user-1",
    responsibleName: "Responsável",
    progressPercentage: over.progressPercentage ?? 100,
    status: over.status ?? ("completed" as const),
    observations: null,
    updatedAt: "2026-08-20T12:00:00.000-03:00",
    revision: 2,
    documents: over.documents ?? [
      {
        id: "doc-old",
        actionRevision: 1,
        kind: "file" as const,
        title: "Comprovante no corte",
        externalLink: null,
        originalFilename: "antes.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
        fileValidationStatus: "valid" as const,
        validatedAt: "2026-08-10T12:00:00.000-03:00",
        createdAt: "2026-08-10T12:00:00.000-03:00",
        isCurrentRevision: false,
      },
      {
        id: "doc-new",
        actionRevision: 2,
        kind: "file" as const,
        title: "Comprovante depois do corte",
        externalLink: null,
        originalFilename: "depois.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
        fileValidationStatus: "valid" as const,
        validatedAt: "2026-09-02T12:00:00.000-03:00",
        createdAt: "2026-09-02T12:00:00.000-03:00",
        isCurrentRevision: true,
      },
    ],
    slaLabel: "ok" as const,
  };
}

function officialFixture(): OfficialReportData {
  return {
    cycleId: "cycle-1",
    cycleProcessingId: "processing-1",
    organizationId: "org-1",
    formId: "form-1",
    organizationName: "Organização",
    formName: "Diagnóstico ESG",
    processingVersion: 1,
    policyVersion: "v1",
    referenceYear: 2026,
    referenceStartYear: 2026,
    referenceEndYear: 2026,
    referencePeriodLabel: "2026",
    actionPlanRevision: 0,
    periodLabel: "2026",
    famiProcessedAt: "2026-07-20T12:00:00.000Z",
    generatedAtIso: "2026-09-10T12:00:00.000Z",
    document: null,
    actionPlan: {
      cycleId: "cycle-1",
      formId: "form-1",
      formName: "Diagnóstico ESG",
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
              recommendationText: "Formalizar o comitê de integridade.",
              recommendationType: "nao_implementacao",
              recommendationStatus: "in_action_plan",
              questionPrompt: "Há comitê formalizado?",
              sectionName: "Integridade",
              actions: [
                action({
                  id: "action-1",
                  actionText: "Publicar portaria atualizada depois do corte",
                  progressPercentage: 100,
                  status: "completed",
                }),
                action({
                  id: "action-depois",
                  actionText: "Ação criada depois do corte",
                  progressPercentage: 10,
                  status: "in_progress",
                  documents: [],
                }),
              ],
            },
          ],
        },
      ],
      summary: {
        totalRecommendations: 1,
        recommendationsWithActions: 1,
        totalActions: 2,
        actionsByStatus: { completed: 1, in_progress: 1 },
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
        percentage: 62,
        maturityLevel: 3,
        pointsObtained: 6.2,
        pointsPossible: 10,
      },
      byAxis: [
        {
          axisId: "gov",
          axisName: "Governanca",
          percentage: 62,
          maturityLevel: 3,
          pointsObtained: 6.2,
          pointsPossible: 10,
        },
      ],
      sections: [],
    },
    actionMovementsByActionId: {
      "action-1": [
        {
          id: "mov-1",
          actionPlanId: "action-1",
          previousPercentage: 0,
          newPercentage: 40,
          description: "Avanço no bimestre",
          createdAt: "2026-08-15T12:00:00.000-03:00",
          responsibleLabel: "Área",
        },
        {
          id: "mov-2",
          actionPlanId: "action-1",
          previousPercentage: 40,
          newPercentage: 100,
          description: "Conclusão depois do corte",
          createdAt: "2026-09-02T12:00:00.000-03:00",
          responsibleLabel: "Área",
        },
      ],
    },
    evidence: { total: 0, approved: 0, pending: 0, rejected: 0, complementation: 0 },
    evolution: [],
    criticalAxesCount: 0,
    advancedAxesCount: 0,
    topOpportunityAxis: null,
    meta: {
      applicableQuestions: 1,
      waivedQuestions: 0,
      notApplicableResponses: 0,
      isOfficialScore: true,
      cycleState: "in_progress",
      closedAt: null,
      responseDeadlineAt: null,
    },
  };
}

const snapshot: BimonthlyTrackingSnapshot = {
  cycleId: "cycle-1",
  referenceYear: 2026,
  bimester: 4,
  reportVersion: 1,
  generationKind: "manual",
  generatedAt: "2026-09-01T00:00:00.000-03:00",
  periodEnd: "2026-08-31",
  actions: [
    {
      actionPlanId: "action-1",
      recommendationId: "rec-1",
      axisId: "gov",
      axisName: "Governanca",
      sectionName: "Integridade",
      questionPrompt: "Há comitê formalizado?",
      recommendationText: "Formalizar o comitê de integridade.",
      actionText: "Publicar portaria do comitê",
      responsibleLabel: "Unidade de Integridade — Ana",
      startDate: "2026-07-01",
      dueDate: "2026-09-24",
      status: "doing",
      progressPercentage: 40,
      revision: 1,
      effectiveAt: "2026-08-20T12:00:00.000-03:00",
      overdue: false,
    },
  ],
};

describe("fotografia bimestral sobre o relatório oficial", () => {
  it("preserva o FAMI oficial e congela o plano no corte", () => {
    const overlaid = overlayBimonthlyTrackingOnOfficialReport(officialFixture(), snapshot);
    const rec = overlaid.actionPlan.axes[0]?.recommendations[0];
    const planAction = rec?.actions[0];

    expect(overlaid.fami.global.percentage).toBe(62);
    expect(overlaid.tracking?.kind).toBe("bimonthly");
    expect(overlaid.tracking?.bimesterLabel).toBe("4º bimestre");
    expect(rec?.actions).toHaveLength(1);
    expect(planAction?.actionText).toBe("Publicar portaria do comitê");
    expect(planAction?.progressPercentage).toBe(40);
    expect(planAction?.status).toBe("in_progress");
    expect(planAction?.revision).toBe(1);
    expect(planAction?.documents.map((document) => document.id)).toEqual(["doc-old"]);
    expect(overlaid.actionMovementsByActionId["action-1"]?.map((movement) => movement.id)).toEqual([
      "mov-1",
    ]);
    expect(overlaid.actionPlan.summary.totalActions).toBe(1);
    expect(overlaid.actionPlan.summary.actionsByStatus).toEqual({ in_progress: 1 });
  });

  it("gera o PDF institucional marcado como acompanhamento bimestral", async () => {
    const overlaid = overlayBimonthlyTrackingOnOfficialReport(officialFixture(), snapshot);
    const bytes = await buildOfficialReportPdfDocument(overlaid);
    const pdf = await PDFDocument.load(bytes);

    expect(bytes.length).toBeGreaterThan(5_000);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(6);
    expect(overlaid.tracking?.disclaimer.toLowerCase()).toContain(
      "plano de integridade e compliance",
    );
    expect(overlaid.tracking?.disclaimer.toLowerCase()).not.toContain("fami");
    expect(BIMONTHLY_TRACKING_DISCLAIMER.toLowerCase()).not.toContain("fami");
  });
});
