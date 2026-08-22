import type { AdminProofStatus as CanonicalAdminProofStatus } from "@/shared/domain/types";

export type EvidenceVerdict =
  | "pending"
  | "approved"
  | "invalidated"
  | "adjustment_requested"
  | "not_presented"
  | "validated_without_proof"
  | "proof_requested"
  | "considered_insufficient";

export type EvidenceKind = "file" | "link" | "text";

export type QueueAnalysisDraft = {
  id: string;
  action: string | null;
  justification: string | null;
  notes: string | null;
  revision: number;
  updatedAt: string;
};

export type QueueEvidence = {
  id: string;
  responseId: string;
  absentEvidence?: boolean;
  allowsNotApplicable?: boolean;
  adminProofObservation?: string | null;
  questionPrompt: string;
  sectionId: string;
  sectionName: string;
  sectionOrder: number;
  axisId: string;
  axisName: string;
  orderIndex: number;
  kind: EvidenceKind;
  title?: string | null;
  textBody?: string | null;
  fileName: string | null;
  externalLink: string | null;
  linkReason: string | null;
  submittedAt: string | null;
  status: EvidenceVerdict;
  justification: string | null;
  validatedAt?: string | null;
  validatedByName?: string | null;
  answer: "yes" | "no";
  respondentNote: string | null;
  answeredByName: string | null;
  answeredAt: string | null;
  analysisDraft?: QueueAnalysisDraft | null;
};

export type QueueEvidenceGroup = {
  responseId: string;
  questionPrompt: string;
  sectionId: string;
  sectionName: string;
  sectionOrder: number;
  axisId: string;
  axisName: string;
  orderIndex: number;
  answer: "yes" | "no";
  respondentNote: string | null;
  answeredByName: string | null;
  answeredAt: string | null;
  allowsNotApplicable: boolean;
  adminProofObservation: string | null;
  adminProofDecidedAt?: string | null;
  adminProofDecidedByName?: string | null;
  status: EvidenceVerdict;
  documents: QueueEvidence[];
  analysisDraft?: QueueAnalysisDraft | null;
};

export type NaQueueStatus = "pending" | "approved" | "rejected";

export type QueueNotApplicable = {
  id: string;
  responseId: string;
  questionPrompt: string;
  sectionId: string;
  sectionName: string;
  sectionOrder: number;
  axisId: string;
  axisName: string;
  orderIndex: number;
  justification: string;
  status: NaQueueStatus;
  rejectionReason: string | null;
  validatedAt?: string | null;
  validatedByName?: string | null;
  source?: "respondent" | "admin";
  originalAnswer?: "yes" | "no" | "not_applicable";
  documents?: Array<{
    id: string;
    kind: "file" | "link" | "text";
    fileName: string | null;
    externalLink: string | null;
    title?: string | null;
    textBody?: string | null;
  }>;
  analysisDraft?: QueueAnalysisDraft | null;
};

export type QueueSectionItem = {
  sectionId: string;
  sectionName: string;
  sectionOrder: number;
  axisId: string;
  axisName: string;
  status: string;
};

export type QueueSectionSummary = {
  id: string;
  title: string;
  axisId: string;
  axisName: string;
  sectionOrder: number;
  pendingCount: number;
  completedCount: number;
  totalCount: number;
  criteriaCount?: number;
  naPendingCount?: number;
  naCompletedCount?: number;
  naTotalCount?: number;
};

export type QueueSectionNavGroup = {
  axisId: string;
  axisName: string;
  sections: QueueSectionSummary[];
};

export type QueueSectionNavigation = {
  groups: QueueSectionNavGroup[];
  sections: QueueSectionSummary[];
  totalPending: number;
  totalCompleted: number;
  total: number;
};

export type QueueProgress = {
  total: number;
  pending: number;
  approved: number;
  invalid: number;
  adjustmentRequested: number;
  notPresented: number;
  validatedWithoutProof: number;
  proofRequested: number;
  naTotal: number;
  naPending: number;
  naApproved: number;
  naRejected: number;
  evaluatedRatio: number;
  readyToConsolidate: boolean;
};

export type AdminProofStatus = CanonicalAdminProofStatus | null | undefined;
