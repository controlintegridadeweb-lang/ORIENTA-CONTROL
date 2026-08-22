import { describe, expect, it } from "vitest";
import {
  answerChangeRequiresFullReload,
  isPersistedAnswerUnchanged,
  patchWorkbenchRowAfterAnswerSave,
} from "./criterion-answer-autosave";
import type { WorkbenchPayload } from "./workbench-helpers";

describe("criterion-answer-autosave helpers", () => {
  it("detecta resposta já persistida sem alteração", () => {
    expect(
      isPersistedAnswerUnchanged(
        { answer: "yes", notes: null, naJustification: null },
        "yes",
        "",
      ),
    ).toBe(true);
    expect(
      isPersistedAnswerUnchanged(
        { answer: "no", notes: null, naJustification: null },
        "yes",
        "",
      ),
    ).toBe(false);
    expect(
      isPersistedAnswerUnchanged(
        {
          answer: "not_applicable",
          notes: "Justificativa com mais de vinte caracteres.",
          naJustification: "Justificativa com mais de vinte caracteres.",
        },
        "not_applicable",
        "Justificativa com mais de vinte caracteres.",
      ),
    ).toBe(true);
  });

  it("exige reload quando a resposta deixa de ser Sim com evidência", () => {
    expect(
      answerChangeRequiresFullReload(
        {
          answer: "yes",
          evidenceId: "ev-1",
          evidences: [{ id: "ev-1" } as never],
        },
        "no",
        false,
      ),
    ).toBe(true);
    expect(
      answerChangeRequiresFullReload(
        { answer: "no", evidenceId: null, evidences: [] },
        "yes",
        false,
      ),
    ).toBe(false);
  });

  it("atualiza apenas o critério no snapshot local", () => {
    const payload: WorkbenchPayload = {
      form: {
        id: "form-1",
        name: "Form",
        version: 1,
        state: "published",
      },
      cycle: { id: "cycle-1", state: "in_response" },
      rows: [
        {
          questionId: "q-1",
          prompt: "P1",
          requiresEvidence: false,
          famiEnabled: true,
          recommendationText: "",
          axisName: "A",
          sectionName: "S",
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
        },
        {
          questionId: "q-2",
          prompt: "P2",
          requiresEvidence: false,
          famiEnabled: true,
          recommendationText: "",
          axisName: "A",
          sectionName: "S",
          responseId: "r-2",
          responseRevision: 2,
          answer: "no",
          notes: "",
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
        },
      ],
    };

    const next = patchWorkbenchRowAfterAnswerSave(payload, "q-1", {
      id: "r-1",
      answer: "yes",
      notes: "",
      revision: 1,
    });

    expect(next.rows[0]?.answer).toBe("yes");
    expect(next.rows[0]?.responseRevision).toBe(1);
    expect(next.rows[1]?.answer).toBe("no");
    expect(next.rows[1]?.responseRevision).toBe(2);
  });
});
