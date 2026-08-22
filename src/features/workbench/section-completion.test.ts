import { describe, expect, it } from "vitest";
import type { WorkbenchRow } from "@/features/workbench/load-workbench-payload";
import { sectionCompletion } from "./section-completion";

function row(overrides: Partial<WorkbenchRow> = {}): WorkbenchRow {
  return {
    questionId: "question-1",
    prompt: "Pergunta",
    requiresEvidence: false,
    famiEnabled: true,
    recommendationText: "",
    axisName: "Governança",
    sectionName: "Seção",
    responseId: null,
    answer: null,
    notes: null,
    isNotApplicable: false,
    naJustification: null,
    naValidationStatus: null,
    naRejectionReason: null,
    evidenceId: null,
    evidenceTitle: null,
    evidenceDescription: null,
    externalLink: null,
    storagePath: null,
    validationStatus: null,
    validationJustification: null,
    ...overrides,
  };
}

const emptyContext = { evidenceDrafts: {} };

describe("sectionCompletion", () => {
  it("conta respostas simples salvas", () => {
    expect(sectionCompletion([row({ answer: "no" }), row({ questionId: "question-2" })], emptyContext)).toEqual({
      completed: 1,
      total: 2,
    });
  });

  it("conclui a resposta Sim sem evidência e deixa a não conformidade para o FAMI", () => {
    expect(
      sectionCompletion(
        [row({ answer: "yes", requiresEvidence: true })],
        emptyContext,
      ),
    ).toEqual({ completed: 1, total: 1 });
  });

  it("considera o rascunho local válido de evidência", () => {
    expect(
      sectionCompletion(
        [row({ requiresEvidence: true })],
        {
          evidenceDrafts: {
            "question-1": {
              kind: "link",
              title: "Relatório",
              description: "",
              externalLink: "https://example.com/relatorio",
              storagePath: null,
              pendingUploadId: null,
              textBody: "",
            },
          },
          pendingYesQuestionIds: new Set(["question-1"]),
        },
      ),
    ).toEqual({ completed: 1, total: 1 });
  });

  it("exige justificativa válida para Não se aplica", () => {
    const pendingNa = new Set(["question-1"]);
    expect(
      sectionCompletion([row()], {
        evidenceDrafts: {},
        pendingNaQuestionIds: pendingNa,
        naJustificationDrafts: { "question-1": "Curta" },
      }),
    ).toEqual({ completed: 0, total: 1 });

    expect(
      sectionCompletion([row()], {
        evidenceDrafts: {},
        pendingNaQuestionIds: pendingNa,
        naJustificationDrafts: {
          "question-1": "Esta justificativa possui informação suficiente.",
        },
      }),
    ).toEqual({ completed: 1, total: 1 });
  });
});
