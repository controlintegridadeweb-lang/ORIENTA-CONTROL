import type { AnswerValue } from "@/shared/domain/types";
import type {
  AbsentProofDecisionAction,
  EvidenceDecisionAction,
} from "./contracts";

/** Ações primárias de validação exibidas na primeira linha do rodapé. */
export type CriterionAdministrativePrimaryAction =
  | EvidenceDecisionAction
  | AbsentProofDecisionAction;

export type CriterionAdministrativeActionKind =
  | "evidence_document"
  | "absent_proof"
  | "readonly";

export type CriterionAdministrativePermissions = {
  canValidateEvidence: boolean;
  canDecideAbsentProof: boolean;
  canMarkAdminNotApplicable: boolean;
  canRequestProof: boolean;
};

export type CriterionAdministrativeState = {
  kind: CriterionAdministrativeActionKind;
  /** Há evidência documental passível de validação (pendente ou em alteração). */
  hasValidatableEvidence: boolean;
  /** Ausência de prova aberta para decisão (pendente ou em alteração). */
  absentProofDecisionOpen: boolean;
  /**
   * Reabertura do rodapé de vereditos em “Não” que já teve decisão administrativa
   * (alterar insuficiente / aprovação sem comprovação).
   */
  negativeDecisionOpen: boolean;
  allowsNotApplicable: boolean;
  answer: AnswerValue;
  adminApplicabilityStatus: "not_applicable" | null;
};

export type ResolvedCriterionAdministrativeActions = {
  primaryActions: CriterionAdministrativePrimaryAction[];
  canMarkNotApplicable: boolean;
};

const EVIDENCE_PRIMARY_ACTIONS: readonly EvidenceDecisionAction[] = [
  "approve",
  "invalidate",
  "request_adjustment",
] as const;

/**
 * Centraliza quais ações administrativas o rodapé do critério deve exibir.
 * A camada visual apenas renderiza o resultado — sem reaplicar regras de domínio.
 */
export function resolveCriterionAdministrativeActions(
  state: CriterionAdministrativeState,
  permissions: CriterionAdministrativePermissions,
): ResolvedCriterionAdministrativeActions {
  const canMarkNotApplicable = canMarkAdminNotApplicable(state, permissions);
  const primaryActions = resolvePrimaryActions(state, permissions);

  return { primaryActions, canMarkNotApplicable };
}

export function canMarkAdminNotApplicable(
  state: Pick<
    CriterionAdministrativeState,
    | "kind"
    | "allowsNotApplicable"
    | "answer"
    | "adminApplicabilityStatus"
    | "absentProofDecisionOpen"
    | "negativeDecisionOpen"
  >,
  permissions: Pick<
    CriterionAdministrativePermissions,
    "canMarkAdminNotApplicable"
  >,
): boolean {
  if (!permissions.canMarkAdminNotApplicable) return false;
  if (!state.allowsNotApplicable) return false;
  if (state.adminApplicabilityStatus === "not_applicable") return false;
  if (state.answer !== "yes" && state.answer !== "no") return false;
  // Em ausência de prova, N/A só acompanha o painel de decisão aberto.
  if (state.kind === "absent_proof" && !state.absentProofDecisionOpen) {
    return false;
  }
  return true;
}

function resolvePrimaryActions(
  state: CriterionAdministrativeState,
  permissions: CriterionAdministrativePermissions,
): CriterionAdministrativePrimaryAction[] {
  if (state.kind === "evidence_document") {
    if (
      !permissions.canValidateEvidence ||
      !state.hasValidatableEvidence
    ) {
      return [];
    }
    return [...EVIDENCE_PRIMARY_ACTIONS];
  }

  if (state.kind === "absent_proof") {
    if (
      !permissions.canDecideAbsentProof ||
      !state.absentProofDecisionOpen
    ) {
      return [];
    }
    const actions: AbsentProofDecisionAction[] = [
      "validate_without_proof",
      "consider_insufficient",
    ];
    if (permissions.canRequestProof) {
      actions.push("request_proof");
    }
    return actions;
  }

  // readonly: vereditos só na reabertura de decisão administrativa prévia.
  if (
    permissions.canDecideAbsentProof &&
    state.negativeDecisionOpen &&
    state.answer === "no" &&
    state.allowsNotApplicable &&
    state.adminApplicabilityStatus === null
  ) {
    return [...EVIDENCE_PRIMARY_ACTIONS];
  }

  return [];
}

export function isEvidencePrimaryAction(
  action: CriterionAdministrativePrimaryAction,
): action is EvidenceDecisionAction {
  return (
    action === "approve" ||
    action === "invalidate" ||
    action === "request_adjustment"
  );
}

export function isAbsentProofPrimaryAction(
  action: CriterionAdministrativePrimaryAction,
): action is AbsentProofDecisionAction {
  return (
    action === "validate_without_proof" ||
    action === "consider_insufficient" ||
    action === "request_proof"
  );
}
