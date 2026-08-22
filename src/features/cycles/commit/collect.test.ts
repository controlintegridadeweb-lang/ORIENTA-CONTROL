import { describe, expect, it } from "vitest";
import { calculateFami } from "@/shared/domain/fami";
import { CURRENT_FAMI_POLICY } from "@/shared/domain/fami-policy";
import {
  assembleProcessingSnapshot,
  type ExpectedQuestionSnapshot,
} from "./collect";

const questionVersionBase = {
  question_id: "question",
  section_id: "section",
  axis_id: "axis",
  fami_enabled: true,
  applies_to_respondent: true,
  evidence_parameter: { required: false },
};

function expected(
  questionVersionId: string,
  overrides: Partial<typeof questionVersionBase> = {},
): ExpectedQuestionSnapshot {
  return {
    question_version_id: questionVersionId,
    question_versions: { ...questionVersionBase, ...overrides },
  };
}

describe("assembleProcessingSnapshot — reconstrução histórica", () => {
  it("reconstrói a estrutura completa e preserva seções compostas somente por N/A ou dispensa", () => {
    const snapshot = assembleProcessingSnapshot({
      cycleId: "cycle",
      cycleProcessingId: "processing",
      expectedQuestions: [
        expected("qv-approved", {
          question_id: "q-approved",
          section_id: "section-applicable",
          axis_id: "axis-applicable",
          evidence_parameter: { required: true },
        }),
        expected("qv-na", {
          question_id: "q-na",
          section_id: "section-na",
          axis_id: "axis-na",
        }),
        expected("qv-waived", {
          question_id: "q-waived",
          section_id: "section-waived",
          axis_id: "axis-waived",
        }),
      ],
      responses: [
        {
          question_version_id: "qv-approved",
          answer: "yes",
          is_not_applicable: false,
        },
        {
          question_version_id: "qv-na",
          answer: "not_applicable",
          is_not_applicable: true,
        },
      ],
      evidences: [
        { question_version_id: "qv-approved", validation_status: "approved" },
      ],
      waivedQuestionVersionIds: new Set(["qv-waived"]),
    });

    expect(snapshot.questions).toHaveLength(3);
    expect(snapshot.questions.find((item) => item.id === "q-approved")?.validationStatus).toBe(
      "approved",
    );
    expect(snapshot.questions.find((item) => item.id === "q-na")?.isNotApplicable).toBe(true);
    expect(snapshot.questions.find((item) => item.id === "q-waived")?.waived).toBe(true);

    const summary = calculateFami(snapshot.questions, CURRENT_FAMI_POLICY);
    expect(summary.global.pointsObtained).toBe(2);
    expect(summary.global.pointsPossible).toBe(2);
    expect(summary.global.percentage).toBe(100);
    expect(summary.bySection["section-na"]?.maturityLevel).toBe("N/A");
    expect(summary.bySection["section-waived"]?.maturityLevel).toBe("N/A");
  });

  it("mantém critério sem snapshot no denominador como resposta negativa", () => {
    const snapshot = assembleProcessingSnapshot({
      cycleId: "cycle",
      cycleProcessingId: "processing",
      expectedQuestions: [expected("qv-missing", { question_id: "q-missing" })],
      responses: [],
      evidences: [],
      waivedQuestionVersionIds: new Set(),
    });

    expect(snapshot.questions[0]).toMatchObject({
      id: "q-missing",
      answer: "no",
      isNotApplicable: false,
      waived: false,
    });
    const summary = calculateFami(snapshot.questions, CURRENT_FAMI_POLICY);
    expect(summary.global.pointsObtained).toBe(0);
    expect(summary.global.pointsPossible).toBe(1);
    expect(summary.global.percentage).toBe(0);
  });

  it("prioriza evidência aprovada quando existem múltiplos snapshots da mesma pergunta", () => {
    const snapshot = assembleProcessingSnapshot({
      cycleId: "cycle",
      cycleProcessingId: "processing",
      expectedQuestions: [
        expected("qv-evidence", {
          question_id: "q-evidence",
          evidence_parameter: { required: true },
        }),
      ],
      responses: [
        {
          question_version_id: "qv-evidence",
          answer: "yes",
          is_not_applicable: false,
        },
      ],
      evidences: [
        { question_version_id: "qv-evidence", validation_status: "insufficient_evidence" },
        { question_version_id: "qv-evidence", validation_status: "approved" },
      ],
      waivedQuestionVersionIds: new Set(),
    });

    expect(snapshot.questions[0].validationStatus).toBe("approved");
    expect(calculateFami(snapshot.questions).global.pointsObtained).toBe(2);
  });

  it("rejeita snapshots que não pertencem à versão congelada do formulário", () => {
    expect(() =>
      assembleProcessingSnapshot({
        cycleId: "cycle",
        cycleProcessingId: "processing",
        expectedQuestions: [expected("qv-valid")],
        responses: [
          {
            question_version_id: "qv-outside",
            answer: "yes",
            is_not_applicable: false,
          },
        ],
        evidences: [],
        waivedQuestionVersionIds: new Set(),
      }),
    ).toThrow("snapshot_question_outside_form");
  });

  it("rejeita resposta histórica duplicada para a mesma pergunta", () => {
    expect(() =>
      assembleProcessingSnapshot({
        cycleId: "cycle",
        cycleProcessingId: "processing",
        expectedQuestions: [expected("qv-duplicate")],
        responses: [
          {
            question_version_id: "qv-duplicate",
            answer: "yes",
            is_not_applicable: false,
          },
          {
            question_version_id: "qv-duplicate",
            answer: "no",
            is_not_applicable: false,
          },
        ],
        evidences: [],
        waivedQuestionVersionIds: new Set(),
      }),
    ).toThrow("duplicate_response_snapshot");
  });
});
