import { describe, expect, it } from "vitest";
import { calculateFami, scoreFamiCriterion } from "./fami";
import {
  CURRENT_FAMI_POLICY,
  FAMI_LEGACY_APPROVED_EVIDENCE_WEIGHT,
  FAMI_LEGACY_UNAPPROVED_EVIDENCE_BASELINE,
  FAMI_WEIGHTS,
  famiPolicyFromFrozenWeights,
} from "./fami-policy";
import { QuestionInput } from "./types";

function q(over: Partial<QuestionInput> & { id: string }): QuestionInput {
  return {
    axisId: "gov",
    sectionId: "s1",
    famiEnabled: true,
    requiresEvidence: false,
    answer: "yes",
    ...over,
  };
}

const W_EV = FAMI_WEIGHTS.WITH_REQUIRED_EVIDENCE_APPROVED;
const W_UNAPPROVED = FAMI_WEIGHTS.WITH_REQUIRED_EVIDENCE_WITHOUT_APPROVAL;

describe("scoreFamiCriterion — regra oficial v7", () => {
  it("Sim sem exigência de evidência → 1,0 de 1,0", () => {
    expect(
      scoreFamiCriterion({
        answer: "yes",
        requiresEvidence: false,
        hasApprovedEvidence: false,
      }),
    ).toEqual({
      obtainedPoints: 1,
      possiblePoints: 1,
      includedInCalculation: true,
    });
  });

  it("Sim com evidência aprovada → 2,0 de 2,0", () => {
    expect(
      scoreFamiCriterion({
        answer: "yes",
        requiresEvidence: true,
        hasApprovedEvidence: true,
      }),
    ).toEqual({
      obtainedPoints: W_EV,
      possiblePoints: W_EV,
      includedInCalculation: true,
    });
  });

  it.each([
    ["ausente", false],
    ["pendente sem aprovação", false],
  ] as const)("Sim com evidência %s → 0 de 2,0", (_label, approved) => {
    expect(
      scoreFamiCriterion({
        answer: "yes",
        requiresEvidence: true,
        hasApprovedEvidence: approved,
      }),
    ).toEqual({
      obtainedPoints: W_UNAPPROVED,
      possiblePoints: W_EV,
      includedInCalculation: true,
    });
  });

  it("Sim insuficiente → 0 de 2,0", () => {
    expect(
      scoreFamiCriterion({
        answer: "yes",
        requiresEvidence: true,
        hasApprovedEvidence: false,
        isInsufficient: true,
      }),
    ).toEqual({
      obtainedPoints: 0,
      possiblePoints: W_EV,
      includedInCalculation: true,
    });
  });

  it("Não sem exigência → 0 de 1,0", () => {
    expect(
      scoreFamiCriterion({
        answer: "no",
        requiresEvidence: false,
        hasApprovedEvidence: false,
      }),
    ).toEqual({
      obtainedPoints: 0,
      possiblePoints: 1,
      includedInCalculation: true,
    });
  });

  it("Não com exigência → 0 de 2,0", () => {
    expect(
      scoreFamiCriterion({
        answer: "no",
        requiresEvidence: true,
        hasApprovedEvidence: false,
      }),
    ).toEqual({
      obtainedPoints: 0,
      possiblePoints: W_EV,
      includedInCalculation: true,
    });
  });

  it("Não se aplica → excluído", () => {
    expect(
      scoreFamiCriterion({
        answer: "not_applicable",
        requiresEvidence: true,
        hasApprovedEvidence: false,
      }),
    ).toEqual({
      obtainedPoints: 0,
      possiblePoints: 0,
      includedInCalculation: false,
    });
  });

  it("nenhum critério com evidência retorna 1 ponto", () => {
    const cases = [
      { hasApprovedEvidence: false, isInsufficient: false },
      { hasApprovedEvidence: false, isInsufficient: true },
      { hasApprovedEvidence: true, isInsufficient: false },
      { answer: "no" as const, hasApprovedEvidence: false, isInsufficient: false },
    ];
    for (const c of cases) {
      const score = scoreFamiCriterion({
        answer: c.answer ?? "yes",
        requiresEvidence: true,
        hasApprovedEvidence: c.hasApprovedEvidence,
        isInsufficient: c.isInsufficient,
      });
      expect(score.obtainedPoints).not.toBe(1);
    }
  });
});

describe("calculateFami — pontuação ponderada por evidência (v7)", () => {
  it("vale 1,0 sem exigência e 2,0 com evidência aprovada", () => {
    const result = calculateFami([
      q({ id: "a", requiresEvidence: false, answer: "yes" }),
      q({ id: "b", requiresEvidence: true, answer: "yes", validationStatus: "approved" }),
    ]);

    expect(result.policyVersion).toBe(CURRENT_FAMI_POLICY.version);
    expect(result.global.pointsPossible).toBe(1 + W_EV);
    expect(result.global.pointsObtained).toBe(1 + W_EV);
    expect(result.global.percentage).toBe(100);
  });

  it("Sim com evidência exigida ausente/pendente vale 0 de 2,0", () => {
    for (const status of ["pending", "submitted", "adjustment_requested"] as const) {
      const result = calculateFami([
        q({ id: "a", requiresEvidence: true, answer: "yes", validationStatus: status }),
      ]);

      expect(result.global.pointsPossible).toBe(W_EV);
      expect(result.global.pointsObtained).toBe(0);
      expect(result.global.percentage).toBe(0);
      expect(result.global.maturityLevel).toBe(1);
    }
  });

  it("Sim insuficiente (documento ou decisão admin) vale 0 de 2,0", () => {
    const byDocument = calculateFami([
      q({
        id: "a",
        requiresEvidence: true,
        answer: "yes",
        validationStatus: "invalidated",
      }),
    ]);
    expect(byDocument.global.pointsObtained).toBe(0);
    expect(byDocument.global.pointsPossible).toBe(W_EV);

    const byAdmin = calculateFami([
      q({
        id: "b",
        requiresEvidence: true,
        answer: "yes",
        adminProofStatus: "considered_insufficient",
      }),
    ]);
    expect(byAdmin.global.pointsObtained).toBe(0);
    expect(byAdmin.global.pointsPossible).toBe(W_EV);
  });

  it("seção combina máximos 1,0 e 2,0; pendente não pontua no numerador", () => {
    const before = calculateFami([
      q({ id: "a", requiresEvidence: false, answer: "yes", sectionId: "s1", axisId: "ax" }),
      q({
        id: "b",
        requiresEvidence: true,
        answer: "yes",
        validationStatus: "submitted",
        sectionId: "s1",
        axisId: "ax",
      }),
    ]);

    expect(before.bySection.s1.pointsPossible).toBe(3);
    expect(before.bySection.s1.pointsObtained).toBe(1);
    expect(before.byAxis.ax.pointsPossible).toBe(3);
    expect(before.global.pointsPossible).toBe(3);
    expect(before.global.percentage).toBe(33.33);
    expect(before.global.percentage).toBeLessThanOrEqual(100);

    const after = calculateFami([
      q({ id: "a", requiresEvidence: false, answer: "yes", sectionId: "s1", axisId: "ax" }),
      q({
        id: "b",
        requiresEvidence: true,
        answer: "yes",
        validationStatus: "approved",
        sectionId: "s1",
        axisId: "ax",
      }),
    ]);

    expect(after.global.pointsObtained).toBe(3);
    expect(after.global.pointsPossible).toBe(3);
    expect(after.global.percentage).toBe(100);
  });
});

describe("política histórica v5/v6 permanece coerente", () => {
  it("recalcula snapshot histórico com 1,5 sem usar a regra v7", () => {
    const historical = famiPolicyFromFrozenWeights({
      version: "v5",
      yesWithoutEvidenceWeight: 1,
      yesWithApprovedEvidenceWeight: FAMI_LEGACY_APPROVED_EVIDENCE_WEIGHT,
      thresholds: CURRENT_FAMI_POLICY.thresholds,
    });
    const result = calculateFami(
      [
        q({ id: "a", requiresEvidence: false, answer: "yes" }),
        q({
          id: "b",
          requiresEvidence: true,
          answer: "yes",
          validationStatus: "approved",
        }),
      ],
      historical,
    );
    expect(result.policyVersion).toBe("v5");
    expect(result.global.pointsPossible).toBe(2.5);
    expect(result.global.pointsObtained).toBe(2.5);
    expect(CURRENT_FAMI_POLICY.yesWithApprovedEvidenceWeight).toBe(2);
  });

  it("v6 congelada mantém baseline 1,0 sem aprovação", () => {
    const historical = famiPolicyFromFrozenWeights({
      version: "v6",
      yesWithoutEvidenceWeight: 1,
      yesWithApprovedEvidenceWeight: 2,
      thresholds: CURRENT_FAMI_POLICY.thresholds,
    });
    expect(historical.yesWithUnapprovedEvidenceWeight).toBe(
      FAMI_LEGACY_UNAPPROVED_EVIDENCE_BASELINE,
    );
    const result = calculateFami(
      [
        q({
          id: "b",
          requiresEvidence: true,
          answer: "yes",
          validationStatus: "pending",
        }),
      ],
      historical,
    );
    expect(result.global.pointsObtained).toBe(1);
    expect(result.global.pointsPossible).toBe(2);
  });
});

describe("calculateFami — respostas e exclusões", () => {
  it("Não recebe zero, mesmo quando a pergunta exige evidência", () => {
    const result = calculateFami([
      q({ id: "a", requiresEvidence: true, answer: "no" }),
    ]);

    expect(result.global.pointsPossible).toBe(W_EV);
    expect(result.global.pointsObtained).toBe(0);
  });

  it("Não se aplica fica fora do numerador e do denominador", () => {
    const result = calculateFami([
      q({ id: "a", requiresEvidence: false, answer: "yes" }),
      q({
        id: "b",
        isNotApplicable: true,
        answer: "not_applicable",
        requiresEvidence: true,
      }),
    ]);

    expect(result.global.pointsPossible).toBe(1);
    expect(result.global.pointsObtained).toBe(1);
  });

  it("nenhum critério aplicável → N/A sem divisão por zero", () => {
    const result = calculateFami([
      q({ id: "a", isNotApplicable: true, answer: "not_applicable" }),
      q({ id: "b", famiEnabled: false, answer: "yes" }),
    ]);

    expect(result.global.pointsPossible).toBe(0);
    expect(result.global.maturityLevel).toBe("N/A");
  });
});
