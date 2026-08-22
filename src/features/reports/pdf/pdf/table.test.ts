import { describe, expect, it } from "vitest";
import type { OfficialReportData } from "../report-types";
import { OrientaPdfDocument } from "./document";
import { drawReportTable } from "./table";
import { contentWidth, reportTheme } from "./theme";

function minimalReportData(): OfficialReportData {
  return {
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
      global: { percentage: 1, maturityLevel: 1, pointsObtained: 1, pointsPossible: 1 },
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
      cycleState: "completed",
      closedAt: null,
      responseDeadlineAt: null,
    },
  };
}

describe("drawReportTable", () => {
  it("repete o cabecalho ao atravessar paginas e nao trunca textos longos", async () => {
    const doc = await OrientaPdfDocument.create(minimalReportData());
    let cur = doc.newPage();
    const long =
      "Texto longo de atualizacao institucional com detalhamento suficiente para exigir quebra de linha natural sem reticencias artificiais no relatorio oficial.";
    const rows = Array.from({ length: 40 }, (_, index) => ({
      date: `0${(index % 9) + 1}/08/2026`,
      action: `Acao ${index + 1} com descricao estendida para validar largura da coluna`,
      progress: `${index}% -> ${index + 1}%`,
      update: long,
      responsible: "Responsavel institucional",
    }));

    const pagesBefore = doc.pdf.getPageCount();
    cur = drawReportTable(
      doc,
      cur,
      [
        { key: "date", header: "Data", width: contentWidth() * 0.14 },
        { key: "action", header: "Acao", width: contentWidth() * 0.22 },
        { key: "progress", header: "Progresso", width: contentWidth() * 0.14 },
        { key: "update", header: "Atualizacao", width: contentWidth() * 0.32 },
        { key: "responsible", header: "Responsavel", width: contentWidth() * 0.18 },
      ],
      rows,
    );

    expect(doc.pdf.getPageCount()).toBeGreaterThan(pagesBefore);
    expect(cur.y).toBeLessThan(reportTheme.page.h);
    expect(long.includes("...")).toBe(false);
  });
});
