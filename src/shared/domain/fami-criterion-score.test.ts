import { describe, expect, it } from "vitest";
import { calculateFamiCriterion, reasonForFamiCriterion } from "./fami";

describe("calculateFamiCriterion", () => {
  it("Sim sem exigência → 1,0 e motivo yes_without_evidence_requirement", () => {
    expect(
      calculateFamiCriterion({
        answer: "yes",
        requiresEvidence: false,
        hasApprovedEvidence: false,
      }),
    ).toEqual({
      obtainedPoints: 1,
      possiblePoints: 1,
      includedInCalculation: true,
      reason: "yes_without_evidence_requirement",
      isOfficial: false,
    });
  });

  it("Sim com evidência aprovada → 2,0 e marca oficial quando solicitado", () => {
    expect(
      calculateFamiCriterion({
        answer: "yes",
        requiresEvidence: true,
        hasApprovedEvidence: true,
        isOfficial: true,
      }),
    ).toEqual({
      obtainedPoints: 2,
      possiblePoints: 2,
      includedInCalculation: true,
      reason: "approved_evidence",
      isOfficial: true,
    });
  });

  it("Sim com comprovação textual aprovada → 2,0 (modalidade irrelevante para FAMI)", () => {
    // hasApprovedEvidence já abstrai arquivo/link/texto; qualquer aprovação válida pontua 2.
    expect(
      calculateFamiCriterion({
        answer: "yes",
        requiresEvidence: true,
        hasApprovedEvidence: true,
      }),
    ).toMatchObject({
      obtainedPoints: 2,
      possiblePoints: 2,
      reason: "approved_evidence",
    });
  });

  it("Sim com evidência não aprovada → 0 de 2,0", () => {
    expect(
      calculateFamiCriterion({
        answer: "yes",
        requiresEvidence: true,
        hasApprovedEvidence: false,
      }),
    ).toMatchObject({
      obtainedPoints: 0,
      possiblePoints: 2,
      includedInCalculation: true,
      reason: "evidence_not_approved",
      isOfficial: false,
    });
  });

  it("Sim insuficiente → 0 de 2,0", () => {
    expect(
      calculateFamiCriterion({
        answer: "yes",
        requiresEvidence: true,
        hasApprovedEvidence: false,
        isInsufficient: true,
      }),
    ).toMatchObject({
      obtainedPoints: 0,
      possiblePoints: 2,
      reason: "insufficient",
    });
  });

  it("Não → 0 e motivo negative_answer", () => {
    expect(
      calculateFamiCriterion({
        answer: "no",
        requiresEvidence: true,
        hasApprovedEvidence: false,
      }),
    ).toMatchObject({
      obtainedPoints: 0,
      possiblePoints: 2,
      reason: "negative_answer",
    });
  });

  it("Não se aplica → fora do cálculo sem 0 de 0 na UI de motivo", () => {
    const result = calculateFamiCriterion({
      answer: "not_applicable",
      requiresEvidence: true,
      hasApprovedEvidence: false,
    });
    expect(result).toEqual({
      obtainedPoints: 0,
      possiblePoints: 0,
      includedInCalculation: false,
      reason: "not_applicable",
      isOfficial: false,
    });
  });

  it("sem resposta → reason unanswered com peso possível", () => {
    expect(
      calculateFamiCriterion({
        answer: null,
        requiresEvidence: true,
        hasApprovedEvidence: false,
      }),
    ).toMatchObject({
      obtainedPoints: 0,
      possiblePoints: 2,
      includedInCalculation: true,
      reason: "unanswered",
      isOfficial: false,
    });
  });

  it("isOfficial não se aplica quando fora do cálculo", () => {
    expect(
      calculateFamiCriterion({
        answer: "not_applicable",
        requiresEvidence: false,
        hasApprovedEvidence: false,
        isOfficial: true,
      }).isOfficial,
    ).toBe(false);
  });
});

describe("reasonForFamiCriterion", () => {
  it("classifica waiver/excluído como not_applicable", () => {
    expect(
      reasonForFamiCriterion({
        answer: "yes",
        requiresEvidence: false,
        hasApprovedEvidence: false,
        includedInCalculation: false,
      }),
    ).toBe("not_applicable");
  });
});
