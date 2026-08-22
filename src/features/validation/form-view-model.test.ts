import { describe, expect, it } from "vitest";
import {
  classifyFormCriterion,
  parseQueueSituationFilter,
  type FormCriterionClassificationInput,
} from "./form-view-model";

function base(
  overrides: Partial<FormCriterionClassificationInput> = {},
): FormCriterionClassificationInput {
  return {
    answer: "yes",
    requiresEvidence: true,
    allowsNotApplicable: false,
    evidenceCount: 1,
    evidenceStatus: "pending",
    naValidationStatus: null,
    adminApplicabilityStatus: null,
    ...overrides,
  };
}

describe("classifyFormCriterion", () => {
  it("marca Sim com evidência pendente como aguardando decisão", () => {
    const result = classifyFormCriterion(base());
    expect(result.validationNeed).toBe("pending_admin");
    expect(result.awaitsAdminAction).toBe(true);
    expect(result.visualStatus).toBe("awaiting_admin");
    expect(result.proofBucket).toBe("with_documents");
  });

  it("marca Sim com evidência aprovada", () => {
    const result = classifyFormCriterion(
      base({ evidenceStatus: "approved", evidenceCount: 2 }),
    );
    expect(result.validationNeed).toBe("analyzed");
    expect(result.adminDecision).toBe("approved");
    expect(result.visualStatus).toBe("positive_evidence_approved");
  });

  it("marca Sim sem exigência de evidência como sem validação", () => {
    const result = classifyFormCriterion(
      base({
        requiresEvidence: false,
        evidenceStatus: null,
        evidenceCount: 0,
      }),
    );
    expect(result.validationNeed).toBe("no_validation");
    expect(result.analysisSituation).toBe("no_validation_needed");
    expect(result.proofBucket).toBe("not_required");
    expect(result.visualStatus).toBe("positive_without_proof");
    expect(result.awaitsAdminAction).toBe(false);
  });

  it("mantém Não regular visível sem exigir validação", () => {
    const result = classifyFormCriterion(
      base({
        answer: "no",
        requiresEvidence: true,
        evidenceStatus: null,
        evidenceCount: 0,
      }),
    );
    expect(result.validationNeed).toBe("no_validation");
    expect(result.visualStatus).toBe("negative");
    expect(result.awaitsAdminAction).toBe(false);
  });

  it("trata Não elegível a N/A admin como resposta negativa sem pendência", () => {
    const result = classifyFormCriterion(
      base({
        answer: "no",
        allowsNotApplicable: true,
        requiresEvidence: false,
        evidenceStatus: null,
        evidenceCount: 0,
      }),
    );
    expect(result.validationNeed).toBe("no_validation");
    expect(result.visualStatus).toBe("negative");
    expect(result.awaitsAdminAction).toBe(false);
  });

  it("encerra pendência de Não elegível quando confirmado insuficiente", () => {
    const result = classifyFormCriterion(
      base({
        answer: "no",
        allowsNotApplicable: true,
        requiresEvidence: true,
        evidenceStatus: "considered_insufficient",
        evidenceCount: 0,
      }),
    );
    expect(result.validationNeed).toBe("analyzed");
    expect(result.adminDecision).toBe("insufficient");
    expect(result.awaitsAdminAction).toBe(false);
  });

  it("trata aprovação administrativa de Não elegível como analisado", () => {
    const result = classifyFormCriterion(
      base({
        answer: "no",
        allowsNotApplicable: true,
        requiresEvidence: true,
        evidenceStatus: "validated_without_proof",
        evidenceCount: 0,
      }),
    );
    expect(result.validationNeed).toBe("analyzed");
    expect(result.adminDecision).toBe("approved");
    expect(result.awaitsAdminAction).toBe(false);
  });

  it("classifica N/A do respondente pendente e aprovado", () => {
    const pending = classifyFormCriterion(
      base({
        answer: "not_applicable",
        requiresEvidence: false,
        evidenceStatus: null,
        evidenceCount: 0,
        naValidationStatus: "pending",
      }),
    );
    expect(pending.awaitsAdminAction).toBe(true);
    expect(pending.visualStatus).toBe("awaiting_admin");

    const approved = classifyFormCriterion(
      base({
        answer: "not_applicable",
        requiresEvidence: false,
        evidenceStatus: null,
        evidenceCount: 0,
        naValidationStatus: "approved",
      }),
    );
    expect(approved.validationNeed).toBe("analyzed");
    expect(approved.visualStatus).toBe("na_respondent");
    expect(approved.adminDecision).toBe("not_applicable");
  });

  it("prioriza N/A administrativo sobre a resposta original", () => {
    const result = classifyFormCriterion(
      base({
        answer: "yes",
        adminApplicabilityStatus: "not_applicable",
        evidenceStatus: "pending",
      }),
    );
    expect(result.validationNeed).toBe("analyzed");
    expect(result.visualStatus).toBe("na_admin");
    expect(result.awaitsAdminAction).toBe(false);
  });

  it("separa aguardando complementação de pendente simples", () => {
    const adjustment = classifyFormCriterion(
      base({ evidenceStatus: "adjustment_requested" }),
    );
    expect(adjustment.analysisSituation).toBe("awaiting_complement");
    expect(adjustment.awaitsAdminAction).toBe(true);

    const proofRequested = classifyFormCriterion(
      base({ evidenceStatus: "proof_requested", evidenceCount: 0 }),
    );
    expect(proofRequested.analysisSituation).toBe("awaiting_complement");
  });
});

describe("parseQueueSituationFilter", () => {
  it("usa pendentes como padrão da fila", () => {
    expect(parseQueueSituationFilter(undefined)).toBe("pending");
    expect(parseQueueSituationFilter("pendente")).toBe("pending");
    expect(parseQueueSituationFilter("aguardando-complementacao")).toBe(
      "awaiting_complement",
    );
    expect(parseQueueSituationFilter("concluidos")).toBe("completed");
    expect(parseQueueSituationFilter("todos-itens")).toBe("all");
  });
});
