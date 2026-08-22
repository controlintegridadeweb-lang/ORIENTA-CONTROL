import type { EvidenceVerdict } from "./queue-model";
import type { FormCriterionClassification, FormCriterionClassificationInput } from "./form-view-types";

const EVIDENCE_AWAITING: ReadonlySet<EvidenceVerdict> = new Set([
  "pending",
  "adjustment_requested",
  "not_presented",
  "proof_requested",
]);

const EVIDENCE_COMPLETED: ReadonlySet<EvidenceVerdict> = new Set([
  "approved",
  "invalidated",
  "considered_insufficient",
  "validated_without_proof",
]);

function isAdminNa(
  adminApplicabilityStatus: "not_applicable" | null,
): boolean {
  return adminApplicabilityStatus === "not_applicable";
}

/**
 * Classifica um critério respondido para a visão unificada.
 * Espelha as regras da fila (evidências / N/A) e inclui o restante do formulário.
 */
export function classifyFormCriterion(
  input: FormCriterionClassificationInput,
): FormCriterionClassification {
  const adminNa = isAdminNa(input.adminApplicabilityStatus);
  const proofBucket: FormCriterionClassification["proofBucket"] =
    !input.requiresEvidence
      ? "not_required"
      : input.evidenceCount > 0
        ? "with_documents"
        : "without_documents";

  if (adminNa) {
    return {
      validationNeed: "analyzed",
      analysisSituation: "completed",
      adminDecision: "not_applicable",
      proofBucket,
      visualStatus: "na_admin",
      awaitsAdminAction: false,
    };
  }

  if (input.answer === "not_applicable") {
    const naStatus = input.naValidationStatus ?? "pending";
    if (naStatus === "pending") {
      return {
        validationNeed: "pending_admin",
        analysisSituation: "pending",
        adminDecision: "none",
        proofBucket,
        visualStatus: "awaiting_admin",
        awaitsAdminAction: true,
      };
    }
    return {
      validationNeed: "analyzed",
      analysisSituation: "completed",
      adminDecision:
        naStatus === "approved" ? "not_applicable" : "none",
      proofBucket,
      visualStatus:
        naStatus === "approved" ? "na_respondent" : "analysis_complete",
      awaitsAdminAction: false,
    };
  }

  if (input.answer === "no") {
    if (input.evidenceStatus === "proof_requested") {
      return {
        validationNeed: "pending_admin",
        analysisSituation: "awaiting_complement",
        adminDecision: "none",
        proofBucket,
        visualStatus: "awaiting_admin",
        awaitsAdminAction: true,
      };
    }
    if (input.evidenceStatus === "considered_insufficient") {
      return {
        validationNeed: "analyzed",
        analysisSituation: "completed",
        adminDecision: "insufficient",
        proofBucket,
        visualStatus: "analysis_complete",
        awaitsAdminAction: false,
      };
    }
    if (input.evidenceStatus === "validated_without_proof") {
      return {
        validationNeed: "analyzed",
        analysisSituation: "completed",
        adminDecision: "approved",
        proofBucket,
        visualStatus: "analysis_complete",
        awaitsAdminAction: false,
      };
    }
    // “Não” do respondente não gera pendência obrigatória — mesmo elegível a N/A.
    // Permanece no formulário completo para preservar a ordem; N/A admin é opcional.
    return {
      validationNeed: "no_validation",
      analysisSituation: "no_validation_needed",
      adminDecision: "none",
      proofBucket,
      visualStatus: "negative",
      awaitsAdminAction: false,
    };
  }

  // answer === "yes"
  if (!input.requiresEvidence) {
    return {
      validationNeed: "no_validation",
      analysisSituation: "no_validation_needed",
      adminDecision: "none",
      proofBucket: "not_required",
      visualStatus: "positive_without_proof",
      awaitsAdminAction: false,
    };
  }

  const evidenceStatus = input.evidenceStatus ?? "not_presented";

  if (
    evidenceStatus === "adjustment_requested" ||
    evidenceStatus === "proof_requested"
  ) {
    return {
      validationNeed: "pending_admin",
      analysisSituation: "awaiting_complement",
      adminDecision: "none",
      proofBucket,
      visualStatus: "awaiting_admin",
      awaitsAdminAction: true,
    };
  }

  if (EVIDENCE_AWAITING.has(evidenceStatus)) {
    return {
      validationNeed: "pending_admin",
      analysisSituation: "pending",
      adminDecision: "none",
      proofBucket,
      visualStatus: "awaiting_admin",
      awaitsAdminAction: true,
    };
  }

  if (evidenceStatus === "approved") {
    return {
      validationNeed: "analyzed",
      analysisSituation: "completed",
      adminDecision: "approved",
      proofBucket,
      visualStatus: "positive_evidence_approved",
      awaitsAdminAction: false,
    };
  }

  if (evidenceStatus === "validated_without_proof") {
    return {
      validationNeed: "analyzed",
      analysisSituation: "completed",
      adminDecision: "validated_without_proof",
      proofBucket,
      visualStatus: "positive_without_proof",
      awaitsAdminAction: false,
    };
  }

  if (
    evidenceStatus === "invalidated" ||
    evidenceStatus === "considered_insufficient"
  ) {
    return {
      validationNeed: "analyzed",
      analysisSituation: "completed",
      adminDecision: "insufficient",
      proofBucket,
      visualStatus: "analysis_complete",
      awaitsAdminAction: false,
    };
  }

  // Fallback defensivo — trata como pendente.
  if (EVIDENCE_COMPLETED.has(evidenceStatus)) {
    return {
      validationNeed: "analyzed",
      analysisSituation: "completed",
      adminDecision: "none",
      proofBucket,
      visualStatus: "analysis_complete",
      awaitsAdminAction: false,
    };
  }

  return {
    validationNeed: "pending_admin",
    analysisSituation: "pending",
    adminDecision: "none",
    proofBucket,
    visualStatus: "awaiting_admin",
    awaitsAdminAction: true,
  };
}
