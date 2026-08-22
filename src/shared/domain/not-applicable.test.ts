import { describe, expect, it } from "vitest";
import {
  isEffectiveNotApplicable,
  validateAdminNaJustification,
  validateNaJustification,
  NA_JUSTIFICATION_MIN_LENGTH,
} from "./not-applicable";
import { isEligibleForFami, scoreFamiCriterion } from "./fami";
import { inferRecommendationDetail } from "./recommendation-engine";
import type { QuestionInput } from "./types";

describe("validateNaJustification", () => {
  it("rejeita texto curto", () => {
    const result = validateNaJustification("curto");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain(String(NA_JUSTIFICATION_MIN_LENGTH));
    }
  });

  it("aceita justificativa com tamanho mínimo", () => {
    const text = "a".repeat(NA_JUSTIFICATION_MIN_LENGTH);
    expect(validateNaJustification(text)).toEqual({
      ok: true,
      justification: text,
    });
  });
});

describe("validateAdminNaJustification", () => {
  it("rejeita vazio ou apenas espaços", () => {
    expect(validateAdminNaJustification("")).toMatchObject({ ok: false });
    expect(validateAdminNaJustification("   ")).toMatchObject({ ok: false });
  });

  it("aceita justificativa com conteúdo", () => {
    expect(validateAdminNaJustification(" Motivo válido ")).toEqual({
      ok: true,
      justification: "Motivo válido",
    });
  });
});

describe("isEffectiveNotApplicable", () => {
  it("só é efetivo com answer N/A e status approved", () => {
    expect(
      isEffectiveNotApplicable({
        answer: "not_applicable",
        naValidationStatus: "pending",
      }),
    ).toBe(false);
    expect(
      isEffectiveNotApplicable({
        answer: "not_applicable",
        naValidationStatus: "approved",
      }),
    ).toBe(true);
    expect(
      isEffectiveNotApplicable({
        answer: "no",
        naValidationStatus: null,
      }),
    ).toBe(false);
  });

  it("N/A administrativo é efetivo sem alterar a resposta original", () => {
    expect(
      isEffectiveNotApplicable({
        answer: "yes",
        naValidationStatus: null,
        adminApplicabilityStatus: "not_applicable",
      }),
    ).toBe(true);
  });
});

describe("impacto no FAMI e recomendação", () => {
  const base = (over: Partial<QuestionInput> = {}): QuestionInput => ({
    id: "q1",
    axisId: "a1",
    sectionId: "s1",
    famiEnabled: true,
    requiresEvidence: false,
    answer: "not_applicable",
    appliesToRespondent: true,
    ...over,
  });

  it("N/A pendente permanece elegível ao FAMI", () => {
    expect(isEligibleForFami(base({ isNotApplicable: false }))).toBe(true);
  });

  it("N/A aprovado remove do FAMI", () => {
    expect(isEligibleForFami(base({ isNotApplicable: true }))).toBe(false);
  });

  it("N/A aprovado não gera recomendação", () => {
    expect(
      inferRecommendationDetail({
        answer: "not_applicable",
        requiresEvidence: false,
        famiEnabled: true,
        isNotApplicable: true,
      }),
    ).toBeNull();
  });

  it("N/A administrativo exclui do denominador e não gera recomendação", () => {
    const question = base({
      answer: "yes",
      requiresEvidence: true,
      isNotApplicable: true,
    });
    expect(isEligibleForFami(question)).toBe(false);
    expect(
      scoreFamiCriterion({
        answer: "yes",
        requiresEvidence: true,
        hasApprovedEvidence: false,
        includedInCalculation: false,
      }),
    ).toEqual({
      obtainedPoints: 0,
      possiblePoints: 0,
      includedInCalculation: false,
    });
    // Sem exclusão, o mesmo critério com exigência de evidência pesaria 2,0.
    expect(
      scoreFamiCriterion({
        answer: "yes",
        requiresEvidence: true,
        hasApprovedEvidence: false,
        includedInCalculation: true,
      }),
    ).toMatchObject({
      obtainedPoints: 0,
      possiblePoints: 2,
      includedInCalculation: true,
    });
    // Sem exigência de evidência, o máximo aplicável seria 1,0.
    expect(
      scoreFamiCriterion({
        answer: "yes",
        requiresEvidence: false,
        hasApprovedEvidence: false,
        includedInCalculation: true,
      }).possiblePoints,
    ).toBe(1);
    expect(
      scoreFamiCriterion({
        answer: "yes",
        requiresEvidence: false,
        hasApprovedEvidence: false,
        includedInCalculation: false,
      }),
    ).toEqual({
      obtainedPoints: 0,
      possiblePoints: 0,
      includedInCalculation: false,
    });
    expect(
      inferRecommendationDetail({
        answer: "yes",
        requiresEvidence: true,
        famiEnabled: true,
        isNotApplicable: true,
      }),
    ).toBeNull();
  });

  it("rejeição tratada como Não gera recomendação quando aplicável", () => {
    expect(
      inferRecommendationDetail({
        answer: "no",
        requiresEvidence: false,
        famiEnabled: true,
        isNotApplicable: false,
      }),
    ).not.toBeNull();
  });
});
