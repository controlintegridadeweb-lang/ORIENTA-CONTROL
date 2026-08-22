import { describe, expect, it } from "vitest";
import {
  canMarkAdminNotApplicable,
  resolveCriterionAdministrativeActions,
  type CriterionAdministrativePermissions,
  type CriterionAdministrativeState,
} from "./administrative-actions";

const basePermissions: CriterionAdministrativePermissions = {
  canValidateEvidence: true,
  canDecideAbsentProof: true,
  canMarkAdminNotApplicable: true,
  canRequestProof: true,
};

function state(
  over: Partial<CriterionAdministrativeState>,
): CriterionAdministrativeState {
  return {
    kind: "readonly",
    hasValidatableEvidence: false,
    absentProofDecisionOpen: false,
    negativeDecisionOpen: false,
    allowsNotApplicable: false,
    answer: "no",
    adminApplicabilityStatus: null,
    ...over,
  };
}

describe("resolveCriterionAdministrativeActions", () => {
  it("ao reabrir decisão de “Não”, oferece o trio de vereditos + N/A", () => {
    const resolved = resolveCriterionAdministrativeActions(
      state({
        kind: "readonly",
        allowsNotApplicable: true,
        answer: "no",
        negativeDecisionOpen: true,
      }),
      basePermissions,
    );
    expect(resolved.primaryActions).toEqual([
      "approve",
      "invalidate",
      "request_adjustment",
    ]);
    expect(resolved.canMarkNotApplicable).toBe(true);
  });

  it("em “Não” sem reabertura, não exige veredito — só N/A opcional", () => {
    const resolved = resolveCriterionAdministrativeActions(
      state({
        kind: "readonly",
        allowsNotApplicable: true,
        answer: "no",
        negativeDecisionOpen: false,
      }),
      basePermissions,
    );
    expect(resolved.primaryActions).toEqual([]);
    expect(resolved.canMarkNotApplicable).toBe(true);
  });

  it("omite vereditos no readonly sem permissão de decisão", () => {
    const resolved = resolveCriterionAdministrativeActions(
      state({
        kind: "readonly",
        allowsNotApplicable: true,
        answer: "no",
        negativeDecisionOpen: true,
      }),
      { ...basePermissions, canDecideAbsentProof: false },
    );
    expect(resolved.primaryActions).toEqual([]);
    expect(resolved.canMarkNotApplicable).toBe(true);
  });

  it("omite N/A quando o critério não é elegível", () => {
    const resolved = resolveCriterionAdministrativeActions(
      state({
        kind: "readonly",
        allowsNotApplicable: false,
        answer: "no",
        negativeDecisionOpen: true,
      }),
      basePermissions,
    );
    expect(resolved.canMarkNotApplicable).toBe(false);
    expect(resolved.primaryActions).toEqual([]);
  });

  it("omite N/A sem permissão administrativa", () => {
    const resolved = resolveCriterionAdministrativeActions(
      state({
        kind: "readonly",
        allowsNotApplicable: true,
        answer: "no",
        negativeDecisionOpen: true,
      }),
      { ...basePermissions, canMarkAdminNotApplicable: false },
    );
    expect(resolved.canMarkNotApplicable).toBe(false);
  });

  it("omite N/A quando já classificado administrativamente", () => {
    const resolved = resolveCriterionAdministrativeActions(
      state({
        kind: "readonly",
        allowsNotApplicable: true,
        answer: "no",
        negativeDecisionOpen: true,
        adminApplicabilityStatus: "not_applicable",
      }),
      basePermissions,
    );
    expect(resolved.canMarkNotApplicable).toBe(false);
  });

  it("com evidência validável, oferece as três ações de evidência", () => {
    const resolved = resolveCriterionAdministrativeActions(
      state({
        kind: "evidence_document",
        hasValidatableEvidence: true,
        allowsNotApplicable: true,
        answer: "yes",
      }),
      basePermissions,
    );
    expect(resolved.primaryActions).toEqual([
      "approve",
      "invalidate",
      "request_adjustment",
    ]);
    expect(resolved.canMarkNotApplicable).toBe(true);
  });

  it("sem evidência validável, omite ações de evidência e mantém N/A elegível", () => {
    const resolved = resolveCriterionAdministrativeActions(
      state({
        kind: "evidence_document",
        hasValidatableEvidence: false,
        allowsNotApplicable: true,
        answer: "yes",
      }),
      basePermissions,
    );
    expect(resolved.primaryActions).toEqual([]);
    expect(resolved.canMarkNotApplicable).toBe(true);
  });

  it("omite ações de evidência sem permissão de validação", () => {
    const resolved = resolveCriterionAdministrativeActions(
      state({
        kind: "evidence_document",
        hasValidatableEvidence: true,
        answer: "yes",
      }),
      { ...basePermissions, canValidateEvidence: false },
    );
    expect(resolved.primaryActions).toEqual([]);
  });

  it("em ausência de prova aberta, oferece decisões de comprovação e N/A", () => {
    const resolved = resolveCriterionAdministrativeActions(
      state({
        kind: "absent_proof",
        absentProofDecisionOpen: true,
        allowsNotApplicable: true,
        answer: "yes",
      }),
      basePermissions,
    );
    expect(resolved.primaryActions).toEqual([
      "validate_without_proof",
      "consider_insufficient",
      "request_proof",
    ]);
    expect(resolved.canMarkNotApplicable).toBe(true);
  });

  it("omite solicitar comprovação sem permissão", () => {
    const resolved = resolveCriterionAdministrativeActions(
      state({
        kind: "absent_proof",
        absentProofDecisionOpen: true,
        answer: "yes",
      }),
      { ...basePermissions, canRequestProof: false },
    );
    expect(resolved.primaryActions).toEqual([
      "validate_without_proof",
      "consider_insufficient",
    ]);
  });

  it("omite decisões de ausência e N/A quando o painel está fechado", () => {
    const resolved = resolveCriterionAdministrativeActions(
      state({
        kind: "absent_proof",
        absentProofDecisionOpen: false,
        allowsNotApplicable: true,
        answer: "yes",
      }),
      basePermissions,
    );
    expect(resolved.primaryActions).toEqual([]);
    expect(resolved.canMarkNotApplicable).toBe(false);
  });
});

describe("canMarkAdminNotApplicable", () => {
  it("exige elegibilidade editorial, resposta Sim/Não e permissão", () => {
    expect(
      canMarkAdminNotApplicable(
        {
          kind: "readonly",
          allowsNotApplicable: true,
          answer: "yes",
          adminApplicabilityStatus: null,
          absentProofDecisionOpen: false,
          negativeDecisionOpen: false,
        },
        { canMarkAdminNotApplicable: true },
      ),
    ).toBe(true);
    expect(
      canMarkAdminNotApplicable(
        {
          kind: "readonly",
          allowsNotApplicable: true,
          answer: "not_applicable",
          adminApplicabilityStatus: null,
          absentProofDecisionOpen: false,
          negativeDecisionOpen: false,
        },
        { canMarkAdminNotApplicable: true },
      ),
    ).toBe(false);
  });
});
