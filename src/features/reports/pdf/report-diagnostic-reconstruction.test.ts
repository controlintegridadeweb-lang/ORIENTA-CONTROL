import { describe, expect, it } from "vitest";
import { buildReportDiagnostic } from "./cycle-report-read";

function question(id: string, orderIndex: number, appliesToRespondent = true) {
  return {
    question_version_id: id,
    order_index: orderIndex,
    question_versions: {
      axis_id: "gov",
      axis_name: "Governanca",
      section_id: "integridade",
      section_name: "Integridade",
      section_order: 1,
      prompt: `Critério ${id}`,
      evidence_parameter: { required: false },
      fami_enabled: true,
      applies_to_respondent: appliesToRespondent,
    },
  };
}

describe("reconstrução do diagnóstico no relatório", () => {
  it("mantém critérios dispensados sem inventar resposta", () => {
    const diagnostic = buildReportDiagnostic({
      questions: [question("q1", 0), question("q2", 1)],
      responses: [{
        question_version_id: "q1",
        answer: "yes",
        is_not_applicable: false,
        na_justification: null,
        na_original_justification: null,
        na_rejection_reason: null,
      }],
      evidences: [],
      waivedQuestionVersionIds: new Set(["q2"]),
    });

    expect(diagnostic.criteria).toHaveLength(2);
    expect(diagnostic.criteria[1]).toMatchObject({
      questionVersionId: "q2",
      answer: null,
      result: "waived",
    });
    expect(diagnostic.summary).toEqual({
      total: 2,
      evaluated: 1,
      attended: 1,
      notAttended: 0,
      insufficientEvidence: 0,
      notApplicable: 0,
      waived: 1,
    });
  });

  it("rejeita snapshot ausente para critério aplicável", () => {
    expect(() => buildReportDiagnostic({
      questions: [question("q1", 0)],
      responses: [],
      evidences: [],
      waivedQuestionVersionIds: new Set(),
    })).toThrow("report_diagnostic_snapshot_missing");
  });
});
