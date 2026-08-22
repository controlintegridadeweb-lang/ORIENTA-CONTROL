import { describe, expect, it } from "vitest";
import { adminEvidenceListPath, respondentEvidenceListPath } from "./evidence-list-paths";

describe("evidence list paths", () => {
  it("preserva filtros e paginação do respondente", () => {
    expect(
      respondentEvidenceListPath({
        search: "contrato social",
        cycleId: "cycle-1",
        formId: "form-1",
        status: "adjustment_requested",
        axisName: "Governança",
        sectionName: "Integridade",
        pendingOnly: true,
        offset: 20,
      }),
    ).toBe(
      "/respondente/evidencias?view=all&search=contrato+social&cycleId=cycle-1&formId=form-1&status=adjustment_requested&axisName=Governan%C3%A7a&sectionName=Integridade&pendingOnly=1&offset=20",
    );
  });

  it("preserva filtros e paginação da administração", () => {
    expect(
      adminEvidenceListPath({
        organizationId: "org-1",
        cycleId: "cycle-1",
        questionId: "question-1",
        evidenceId: "evidence-1",
        status: "submitted",
        offset: 25,
      }),
    ).toBe(
      "/admin/evidencias?cycleId=cycle-1&questionId=question-1&evidenceId=evidence-1&organizationId=org-1&status=submitted&offset=25",
    );
  });
});
