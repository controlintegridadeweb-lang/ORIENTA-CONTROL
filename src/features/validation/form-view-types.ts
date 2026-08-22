import type { AnswerValue } from "@/shared/domain/types";
import type { EvidenceVerdict, NaQueueStatus } from "./queue-model";

export type QueueSituationFilter =
  | "pending"
  | "awaiting_complement"
  | "completed"
  | "all";
export type FormAnswerFilter = "all" | "yes" | "no" | "not_applicable";
export type FormAnalysisSituation =
  | "all"
  | "pending"
  | "completed"
  | "awaiting_complement"
  | "no_validation_needed";
export type FormAdminDecisionFilter =
  | "all"
  | "none"
  | "approved"
  | "validated_without_proof"
  | "insufficient"
  | "not_applicable";
export type FormProofFilter =
  | "all"
  | "with_documents"
  | "without_documents"
  | "not_required";
export type FormCriterionVisualStatus =
  | "positive_evidence_approved"
  | "positive_without_proof"
  | "negative"
  | "na_respondent"
  | "na_admin"
  | "awaiting_admin"
  | "analysis_complete";
export type FormValidationNeed =
  | "pending_admin"
  | "analyzed"
  | "no_validation";

export type FormCriterionClassificationInput = {
  answer: AnswerValue;
  requiresEvidence: boolean;
  allowsNotApplicable: boolean;
  evidenceCount: number;
  evidenceStatus: EvidenceVerdict | null;
  naValidationStatus: NaQueueStatus | null;
  adminApplicabilityStatus: "not_applicable" | null;
};

export type FormCriterionClassification = {
  validationNeed: FormValidationNeed;
  analysisSituation: Exclude<FormAnalysisSituation, "all">;
  adminDecision: Exclude<FormAdminDecisionFilter, "all">;
  proofBucket: Exclude<FormProofFilter, "all">;
  visualStatus: FormCriterionVisualStatus;
  awaitsAdminAction: boolean;
};

export type FormViewSummary = {
  totalCriteria: number;
  answerYes: number;
  answerNo: number;
  answerNotApplicable: number;
  pendingAnalysis: number;
  analyzed: number;
  noValidationNeeded: number;
};
