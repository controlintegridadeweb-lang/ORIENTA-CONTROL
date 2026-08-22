import { describe, expect, it } from "vitest";
import {
  evaluateSubmissionProgress,
  evaluateSubmissionReadiness,
  isEligibleForRecommendation,
  type SubmissionQuestion,
} from "./submission";

function q(over: Partial<SubmissionQuestion> & { questionId: string }): SubmissionQuestion {
  return {
    appliesToRespondent: true, isNotApplicable: false, hasWaiver: false,
    famiEnabled: true, requiresEvidence: false, answer: "yes", hasActiveEvidence: false,
    ...over,
  };
}

describe("predicados de elegibilidade (211)", () => {
  it("elegível = applies ∧ ¬n/a ∧ ¬waiver", () => {
    expect(isEligibleForRecommendation(q({ questionId: "a" }))).toBe(true);
    expect(isEligibleForRecommendation(q({ questionId: "b", isNotApplicable: true }))).toBe(false);
    expect(isEligibleForRecommendation(q({ questionId: "c", hasWaiver: true }))).toBe(false);
    expect(isEligibleForRecommendation(q({ questionId: "d", appliesToRespondent: false }))).toBe(false);
  });
});

describe("evaluateSubmissionReadiness (261)", () => {
  it("tudo respondido e evidências ok → pronto", () => {
    const r = evaluateSubmissionReadiness([
      q({ questionId: "a", answer: "yes", requiresEvidence: false }),
      q({ questionId: "b", answer: "no" }),
      q({ questionId: "c", answer: "yes", requiresEvidence: true, hasActiveEvidence: true }),
    ]);
    expect(r.ready).toBe(true);
    expect(r.blocks).toEqual([]);
  });

  it("critério elegível sem resposta bloqueia", () => {
    const r = evaluateSubmissionReadiness([q({ questionId: "a", answer: null })]);
    expect(r.ready).toBe(false);
    expect(r.blocks).toEqual([{ questionId: "a", reason: "unanswered" }]);
  });

  it("'Sim' que exige evidência sem anexo pode ser enviado para diagnóstico", () => {
    const r = evaluateSubmissionReadiness([
      q({ questionId: "a", answer: "yes", requiresEvidence: true, hasActiveEvidence: false }),
    ]);
    expect(r.ready).toBe(true);
    expect(r.blocks).toEqual([]);
  });

  it("'Não' que exige evidência NÃO precisa de anexo", () => {
    const r = evaluateSubmissionReadiness([
      q({ questionId: "a", answer: "no", requiresEvidence: true, hasActiveEvidence: false }),
    ]);
    expect(r.ready).toBe(true);
  });

  it("não-elegíveis nunca bloqueiam (n/a, waiver, não-respondente)", () => {
    const r = evaluateSubmissionReadiness([
      q({ questionId: "a", isNotApplicable: true, answer: null }),
      q({ questionId: "b", hasWaiver: true, answer: null }),
      q({ questionId: "c", appliesToRespondent: false, answer: null }),
    ]);
    expect(r.ready).toBe(true);
  });

  it("acumula múltiplos bloqueios", () => {
    const r = evaluateSubmissionReadiness([
      q({ questionId: "a", answer: null }),
      q({ questionId: "b", answer: "yes", requiresEvidence: true, hasActiveEvidence: false }),
      q({ questionId: "ok", answer: "no" }),
    ]);
    expect(r.blocks).toHaveLength(1);
    expect(r.ready).toBe(false);
  });

  it("bloqueia reenvio enquanto a evidência solicitada não foi corrigida", () => {
    const r = evaluateSubmissionReadiness(
      [
        q({
          questionId: "ajuste",
          answer: "yes",
          requiresEvidence: true,
          hasActiveEvidence: true,
          validationStatus: "adjustment_requested",
        }),
      ],
      { requireResolvedAdjustments: true },
    );
    expect(r.ready).toBe(false);
    expect(r.blocks).toEqual([
      { questionId: "ajuste", reason: "unresolved_evidence_adjustment" },
    ]);
  });

  it("aceita o reenvio quando todas as devolutivas possuem substituição própria", () => {
    const r = evaluateSubmissionReadiness(
      [
        q({
          questionId: "ajuste",
          answer: "yes",
          requiresEvidence: true,
          hasActiveEvidence: true,
          validationStatus: "adjustment_requested",
          adjustmentRequestCount: 2,
          resolvedAdjustmentRequestCount: 2,
          unresolvedAdjustmentRequestCount: 0,
          hasResolvedAllAdjustments: true,
        }),
      ],
      { requireResolvedAdjustments: true },
    );
    expect(r.ready).toBe(true);
  });

  it("bloqueia reenvio enquanto a comprovação ausente não foi enviada", () => {
    const r = evaluateSubmissionReadiness(
      [
        q({
          questionId: "prova",
          answer: "yes",
          requiresEvidence: true,
          hasActiveEvidence: false,
          proofRequested: true,
          unresolvedAdjustmentRequestCount: 1,
          hasResolvedAllAdjustments: false,
        }),
      ],
      { requireResolvedAdjustments: true },
    );
    expect(r.ready).toBe(false);
    expect(r.blocks).toEqual([
      { questionId: "prova", reason: "unresolved_evidence_adjustment" },
    ]);
  });
});

describe("evaluateSubmissionProgress", () => {
  it("usa apenas criterios elegiveis no progresso", () => {
    const progress = evaluateSubmissionProgress([
      q({ questionId: "answered", answer: "no" }),
      q({ questionId: "pending", answer: null }),
      q({ questionId: "waived", answer: null, hasWaiver: true }),
      q({ questionId: "not-applicable", answer: "not_applicable", isNotApplicable: true }),
    ]);

    expect(progress.totalEligible).toBe(2);
    expect(progress.answeredEligible).toBe(1);
    expect(progress.ready).toBe(false);
    expect(progress.blocks).toEqual([{ questionId: "pending", reason: "unanswered" }]);
  });

  it("considera preenchida uma resposta sim sem evidência, deixando a não conformidade para o FAMI", () => {
    const progress = evaluateSubmissionProgress([
      q({
        questionId: "requires-evidence",
        answer: "yes",
        requiresEvidence: true,
        hasActiveEvidence: false,
      }),
    ]);

    expect(progress.answeredEligible).toBe(1);
    expect(progress.totalEligible).toBe(1);
    expect(progress.ready).toBe(true);
    expect(progress.blocks).toEqual([]);
  });
});
