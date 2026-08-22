import type {
  FormAdminDecisionFilter,
  FormAnalysisSituation,
  FormAnswerFilter,
  FormCriterionVisualStatus,
  FormProofFilter,
  FormValidationNeed,
  FormViewSummary,
  QueueSituationFilter,
} from "./form-view-model";
import type {
  EvidenceVerdict,
  QueueEvidence,
  QueueEvidenceGroup,
  QueueNotApplicable,
  QueueSectionSummary,
} from "./queue-model";
import type { ValidationPageSize } from "./pagination";
import type { AnswerValue } from "@/shared/domain/types";

export type UnifiedFormCriterion = {
  responseId: string;
  questionPrompt: string;
  sectionId: string;
  sectionName: string;
  sectionOrder: number;
  axisId: string;
  axisName: string;
  orderIndex: number;
  answer: AnswerValue;
  requiresEvidence: boolean;
  allowsNotApplicable: boolean;
  famiEnabled: boolean;
  respondentNote: string | null;
  naJustification: string | null;
  answeredByName: string | null;
  answeredAt: string | null;
  evidenceCount: number;
  evidenceStatus: EvidenceVerdict | null;
  validationNeed: FormValidationNeed;
  visualStatus: FormCriterionVisualStatus;
  visualStatusLabel: string;
  awaitsAdminAction: boolean;
  obtainedPoints: number;
  possiblePoints: number;
  includedInCalculation: boolean;
  recommendationText: string | null;
  documents: QueueEvidence[];
  evidenceGroup: QueueEvidenceGroup | null;
  notApplicableItem: QueueNotApplicable | null;
  readonlyView: boolean;
};

export type ValidationViewMode = "fila" | "formulario";

export type ValidationFormPageResult = {
  mode: ValidationViewMode;
  page: number;
  pageSize: ValidationPageSize;
  totalItems: number;
  sectionId: string | null;
  axisId: string | null;
  queueSituation: QueueSituationFilter;
  answer: FormAnswerFilter;
  situation: FormAnalysisSituation;
  decision: FormAdminDecisionFilter;
  proof: FormProofFilter;
  search: string;
  criteria: UnifiedFormCriterion[];
  formSummary: FormViewSummary;
  formSections: QueueSectionSummary[];
};

export type EvidenceDecisionAction =
  | "approve"
  | "invalidate"
  | "request_adjustment";
export type NotApplicableDecisionAction = "approve" | "reject";
export type AbsentProofDecisionAction =
  | "validate_without_proof"
  | "request_proof"
  | "consider_insufficient";
