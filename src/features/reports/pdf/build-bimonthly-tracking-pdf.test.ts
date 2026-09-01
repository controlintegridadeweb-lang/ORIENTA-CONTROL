import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadOfficialReportData, buildOfficialReportPdfDocument } = vi.hoisted(() => ({
  loadOfficialReportData: vi.fn(),
  buildOfficialReportPdfDocument: vi.fn(),
}));

vi.mock("./build-official-report-data", () => ({ loadOfficialReportData }));
vi.mock("./pdf/build-official-report", () => ({ buildOfficialReportPdfDocument }));

import {
  bimonthlyTrackingPdfFilename,
  buildBimonthlyTrackingPdf,
} from "./build-bimonthly-tracking-pdf";
import { BIMONTHLY_TRACKING_OFFICIAL_BASE_MISSING } from "./overlay-bimonthly-tracking";
import type { OfficialReportData } from "./report-types";

const snapshot = {
  cycleId: "cycle-1",
  referenceYear: 2026,
  bimester: 4 as const,
  reportVersion: 1,
  generationKind: "manual" as const,
  generatedAt: "2026-09-01T00:00:00.000-03:00",
  periodEnd: "2026-08-31",
  actions: [],
};

describe("PDF de acompanhamento bimestral", () => {
  beforeEach(() => {
    loadOfficialReportData.mockReset();
    buildOfficialReportPdfDocument.mockReset();
  });

  it("nomeia o arquivo pelo ano e bimestre", () => {
    expect(bimonthlyTrackingPdfFilename(snapshot)).toMatch(/^relatorio-bimestral-2026-b4-/);
  });

  it("recusa a exportação sem Resultado FAMI oficial", async () => {
    loadOfficialReportData.mockResolvedValue(null);
    await expect(
      buildBimonthlyTrackingPdf({ snapshot, client: {} as never }),
    ).rejects.toThrow(BIMONTHLY_TRACKING_OFFICIAL_BASE_MISSING);
    expect(buildOfficialReportPdfDocument).not.toHaveBeenCalled();
  });

  it("monta o PDF institucional com a fotografia do plano", async () => {
    const official: OfficialReportData = {
      cycleId: "cycle-1",
      cycleProcessingId: "processing-1",
      organizationId: "org-1",
      formId: "form-1",
      organizationName: "Org",
      formName: "Form",
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
        formName: "Form",
        formVersion: 1,
        organizationId: "org-1",
        organizationName: "Org",
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
        global: { percentage: 62, maturityLevel: 3, pointsObtained: 6.2, pointsPossible: 10 },
        byAxis: [],
        sections: [],
      },
      actionMovementsByActionId: {},
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
    loadOfficialReportData.mockResolvedValue(official);
    buildOfficialReportPdfDocument.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const file = await buildBimonthlyTrackingPdf({ snapshot, client: {} as never });

    expect(loadOfficialReportData).toHaveBeenCalledWith(
      { cycleId: "cycle-1", allowOpenActionPlan: true },
      {},
    );
    expect(buildOfficialReportPdfDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        tracking: expect.objectContaining({ kind: "bimonthly", bimester: 4 }),
      }),
    );
    expect(file.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(file.filename).toMatch(/^relatorio-bimestral-2026-b4-/);
  });
});
