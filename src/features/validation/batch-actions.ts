import { canMarkAdminNotApplicable } from "./administrative-actions";
import type {
  EvidenceDecisionAction,
  NotApplicableDecisionAction,
  UnifiedFormCriterion,
} from "./contracts";
import type { QueueEvidence, QueueNotApplicable } from "./queue-model";

export type ValidationBatchAction =
  | "approve_evidence"
  | "invalidate_evidence"
  | "request_adjustment"
  | "approve_not_applicable"
  | "reject_not_applicable"
  | "mark_admin_not_applicable";

export type ValidationBatchOption = {
  action: ValidationBatchAction;
  label: string;
  requiresJustification: boolean;
  justificationLabel: string;
};

export type ValidationBatchEvidenceItem = {
  id: string;
  status: "pending" | "approved" | "invalidated" | "adjustment_requested";
  validatedAt: string | null;
};

export type ValidationBatchNotApplicableItem = {
  id: string;
  status: QueueNotApplicable["status"];
  validatedAt: string | null;
};

export type ValidationBatchCommand =
  | {
      kind: "evidence";
      items: ValidationBatchEvidenceItem[];
      action: EvidenceDecisionAction;
      justification: string | null;
    }
  | {
      kind: "not_applicable";
      items: ValidationBatchNotApplicableItem[];
      action: NotApplicableDecisionAction;
      rejectionReason: string | null;
    }
  | {
      kind: "admin_not_applicable";
      responseIds: string[];
      justification: string;
    };

export type ValidationBatchExecutionResult = {
  results: Array<{
    id: string;
    status: "succeeded" | "failed";
    message?: string;
  }>;
};

export type ValidationBatchSelection = {
  criteria: UnifiedFormCriterion[];
  options: ValidationBatchOption[];
  evidenceItems: ValidationBatchEvidenceItem[];
  notApplicableItems: ValidationBatchNotApplicableItem[];
  adminNotApplicableResponseIds: string[];
};

const EVIDENCE_OPTION: Record<
  EvidenceDecisionAction,
  ValidationBatchOption
> = {
  approve: {
    action: "approve_evidence",
    label: "Aprovar evidências",
    requiresJustification: false,
    justificationLabel: "Observação opcional",
  },
  invalidate: {
    action: "invalidate_evidence",
    label: "Considerar evidências insuficientes",
    requiresJustification: true,
    justificationLabel: "Justificativa da insuficiência",
  },
  request_adjustment: {
    action: "request_adjustment",
    label: "Solicitar ajustes",
    requiresJustification: true,
    justificationLabel: "Orientação para o respondente",
  },
};

const NOT_APPLICABLE_OPTION: Record<
  NotApplicableDecisionAction,
  ValidationBatchOption
> = {
  approve: {
    action: "approve_not_applicable",
    label: "Aceitar “Não se aplica”",
    requiresJustification: false,
    justificationLabel: "Observação opcional",
  },
  reject: {
    action: "reject_not_applicable",
    label: "Rejeitar “Não se aplica”",
    requiresJustification: true,
    justificationLabel: "Motivo da rejeição",
  },
};

const ADMIN_NOT_APPLICABLE_OPTION: ValidationBatchOption = {
  action: "mark_admin_not_applicable",
  label: "Classificar como “Não se aplica”",
  requiresJustification: true,
  justificationLabel: "Justificativa administrativa",
};

function isBatchEvidenceStatus(
  status: QueueEvidence["status"],
): status is ValidationBatchEvidenceItem["status"] {
  return (
    status === "pending" ||
    status === "approved" ||
    status === "invalidated" ||
    status === "adjustment_requested"
  );
}

function evidenceItemsForCriterion(
  criterion: UnifiedFormCriterion,
): ValidationBatchEvidenceItem[] {
  const items: ValidationBatchEvidenceItem[] = [];
  for (const document of criterion.evidenceGroup?.documents ?? []) {
    if (document.absentEvidence || !isBatchEvidenceStatus(document.status)) {
      continue;
    }
    items.push({
      id: document.id,
      status: document.status,
      validatedAt: document.validatedAt ?? null,
    });
  }
  return items;
}

function isAdminNotApplicableEligible(
  criterion: UnifiedFormCriterion,
): boolean {
  if (criterion.notApplicableItem !== null) return false;
  return canMarkAdminNotApplicable(
    {
      kind: "readonly",
      allowsNotApplicable: criterion.allowsNotApplicable,
      answer: criterion.answer,
      adminApplicabilityStatus: null,
      absentProofDecisionOpen: false,
      negativeDecisionOpen: false,
    },
    { canMarkAdminNotApplicable: true },
  );
}

export function isCriterionBatchSelectable(
  criterion: UnifiedFormCriterion,
): boolean {
  return (
    evidenceItemsForCriterion(criterion).length > 0 ||
    criterion.notApplicableItem !== null ||
    isAdminNotApplicableEligible(criterion)
  );
}

export function buildValidationBatchSelection(
  criteria: UnifiedFormCriterion[],
  selectedResponseIds: ReadonlySet<string>,
): ValidationBatchSelection {
  const selected = criteria.filter((criterion) =>
    selectedResponseIds.has(criterion.responseId),
  );
  const evidenceByCriterion = selected.map(evidenceItemsForCriterion);
  const evidenceItems = evidenceByCriterion.flat();
  const notApplicableItems = selected.flatMap((criterion) => {
    const item = criterion.notApplicableItem;
    return item
      ? [
          {
            id: item.id,
            status: item.status,
            validatedAt: item.validatedAt ?? null,
          },
        ]
      : [];
  });
  const adminNotApplicableResponseIds = selected
    .filter(isAdminNotApplicableEligible)
    .map((criterion) => criterion.responseId);

  const options: ValidationBatchOption[] = [];
  if (
    selected.length > 0 &&
    evidenceByCriterion.every((items) => items.length > 0)
  ) {
    options.push(
      EVIDENCE_OPTION.approve,
      EVIDENCE_OPTION.invalidate,
      EVIDENCE_OPTION.request_adjustment,
    );
  }
  if (
    selected.length > 0 &&
    notApplicableItems.length === selected.length
  ) {
    options.push(
      NOT_APPLICABLE_OPTION.approve,
      NOT_APPLICABLE_OPTION.reject,
    );
  }
  if (
    selected.length > 0 &&
    adminNotApplicableResponseIds.length === selected.length
  ) {
    options.push(ADMIN_NOT_APPLICABLE_OPTION);
  }

  return {
    criteria: selected,
    options,
    evidenceItems,
    notApplicableItems,
    adminNotApplicableResponseIds,
  };
}

export function buildValidationBatchCommand(
  selection: ValidationBatchSelection,
  action: ValidationBatchAction,
  justification: string,
): ValidationBatchCommand {
  const normalizedJustification = justification.trim();
  switch (action) {
    case "approve_evidence":
      return {
        kind: "evidence",
        items: selection.evidenceItems,
        action: "approve",
        justification: normalizedJustification || null,
      };
    case "invalidate_evidence":
      return {
        kind: "evidence",
        items: selection.evidenceItems,
        action: "invalidate",
        justification: normalizedJustification,
      };
    case "request_adjustment":
      return {
        kind: "evidence",
        items: selection.evidenceItems,
        action: "request_adjustment",
        justification: normalizedJustification,
      };
    case "approve_not_applicable":
      return {
        kind: "not_applicable",
        items: selection.notApplicableItems,
        action: "approve",
        rejectionReason: null,
      };
    case "reject_not_applicable":
      return {
        kind: "not_applicable",
        items: selection.notApplicableItems,
        action: "reject",
        rejectionReason: normalizedJustification,
      };
    case "mark_admin_not_applicable":
      return {
        kind: "admin_not_applicable",
        responseIds: selection.adminNotApplicableResponseIds,
        justification: normalizedJustification,
      };
  }
}
