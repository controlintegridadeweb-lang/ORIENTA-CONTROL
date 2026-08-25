import type { ActionPlanByCyclePayload } from "@/features/improvement-management";
import type { AxisMaturity } from "@/features/fami";

export type CycleReportScope = {
  cycleId: string;
  cycleState: string;
  formVersionId: string;
  formId: string;
  formName: string;
  formVersion: number;
  organizationId: string;
  organizationName: string;
  responseDeadlineAt: string | null;
  periodLabel: string;
  referenceStartYear: number | null;
  referenceEndYear: number | null;
  actionPlanRevision: number;
};

export type ReportFamiSectionScore = {
  sectionId: string;
  sectionName: string;
  axisId: string | null;
  percentage: number;
  maturityLevel: number | null;
  pointsObtained: number;
  pointsPossible: number;
};

export type ReportFamiAxisScore = {
  axisId: string | null;
  axisName: string;
  percentage: number;
  maturityLevel: number | null;
  pointsObtained: number;
  pointsPossible: number;
};

export type CycleFamiReportSnapshot = {
  cycleProcessingId: string;
  processingVersion: number;
  policyVersion: string;
  processingStatus: "working" | "completed";
  processingCompletedAt: string | null;
  global: {
    percentage: number;
    maturityLevel: number | null;
    pointsObtained: number;
    pointsPossible: number;
    createdAt: string;
  } | null;
  axes: Array<AxisMaturity & { pointsObtained: number; pointsPossible: number }>;
  sections: ReportFamiSectionScore[];
};

export type ReportEvidenceSummary = {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  complementation: number;
};

export type ReportDiagnosticResult =
  | "attended"
  | "not_attended"
  | "insufficient_evidence"
  | "not_applicable"
  | "waived";

export type ReportEvidenceStatus =
  | "approved"
  | "pending"
  | "invalidated"
  | "adjustment_requested"
  | "missing"
  | "not_required";

export type ReportDiagnosticCriterion = {
  questionVersionId: string;
  axisId: string;
  axisName: string;
  sectionId: string;
  sectionName: string;
  sectionOrder: number;
  orderIndex: number;
  prompt: string;
  answer: "yes" | "no" | "not_applicable" | null;
  requiresEvidence: boolean;
  evidenceCount: number;
  evidenceStatus: ReportEvidenceStatus;
  evidenceJustifications: string[];
  result: ReportDiagnosticResult;
  notApplicableJustification: string | null;
  notApplicableRejectionReason: string | null;
};

type ReportDiagnosticAxisSummary = {
  axisId: string;
  axisName: string;
  total: number;
  evaluated: number;
  attended: number;
  notAttended: number;
  insufficientEvidence: number;
  notApplicable: number;
  waived: number;
};

export type ReportDiagnostic = {
  criteria: ReportDiagnosticCriterion[];
  summary: {
    total: number;
    evaluated: number;
    attended: number;
    notAttended: number;
    insufficientEvidence: number;
    notApplicable: number;
    waived: number;
  };
  byAxis: ReportDiagnosticAxisSummary[];
};

export type ReportEvolutionPoint = {
  cycleId: string;
  referenceStartYear: number;
  referenceEndYear: number;
  referenceLabel: string;
  processingVersion: number;
  policyVersion: string;
  createdAt: string;
  globalPercentage: number | null;
  globalMaturityLevel: number | null;
  axisPercentages: Record<string, number | null>;
};

export type ReportDocumentIdentity = {
  reportId: string;
  emissionVersion: number;
  generatedByLabel: string;
  generatedAtIso: string;
  reissueReason: string | null;
  contentSha256: string;
};

/** Movimentação persistida de progresso de uma ação (fonte: action_plan_progress_updates). */
export type ReportActionMovementSource = {
  id: string;
  actionPlanId: string;
  previousPercentage: number;
  newPercentage: number;
  description: string | null;
  createdAt: string;
  responsibleLabel: string;
};

/** View model linear da análise detalhada (apenas apresentação). */
export type ReportMovementView = {
  id: string;
  dateLabel: string;
  actionTitle: string;
  progressLabel: string;
  updateText: string;
  responsibleLabel: string;
  createdAtIso: string;
};

export type ReportActionDocumentView = {
  line: string;
};

export type ReportActionView = {
  id: string;
  numberLabel: string;
  title: string;
  responsibleLabel: string;
  responsibleSectorLabel: string;
  responsibleNameLabel: string;
  startLabel: string;
  endLabel: string;
  progressPercentage: number;
  statusLabel: string;
  isOverdue: boolean;
  isCancelled: boolean;
  /** Rastreabilidade: a ação pertence ao plano da seção, mas nasce de uma recomendação. */
  originRecommendationId: string;
  originRecommendationNumberLabel: string;
  originRecommendationText: string;
  originCriterion: string;
  documents: ReportActionDocumentView[];
  movements: ReportMovementView[];
};

export type ReportRecommendationView = {
  id: string;
  numberLabel: string;
  diagnosisLabel: string;
  axisName: string;
  sectionName: string;
  originCriterion: string;
  answerLabel: string;
  adminAnalysisLabel: string | null;
  reasonLabel: string;
  recommendationText: string;
  statusLabel: string;
  /** Ações vinculadas a esta recomendação (hierarquia guarda-chuva). */
  actions: ReportActionView[];
};

export type ReportSectionActionPlanSummaryView = {
  totalActions: number;
  activeActions: number;
  notStartedActions: number;
  inProgressActions: number;
  completedActions: number;
  cancelledActions: number;
  overdueActions: number;
  progressPercentage: number;
  statusLabel: string;
};

export type ReportSectionActionPlanView = {
  summary: ReportSectionActionPlanSummaryView;
  actions: ReportActionView[];
};

export type ReportSectionSummaryView = {
  name: string;
  pointsObtained: number | null;
  pointsPossible: number | null;
  percentage: number | null;
  criteriaCount: number;
  recommendationsCount: number;
  actionsCount: number;
};

export type ReportSectionView = {
  id: string;
  numberLabel: string;
  title: string;
  order: number;
  summary: ReportSectionSummaryView;
  recommendations: ReportRecommendationView[];
  actionPlan: ReportSectionActionPlanView;
};

export type ReportAxisSummaryView = {
  name: string;
  pointsObtained: number | null;
  pointsPossible: number | null;
  percentage: number | null;
  maturityLabel: string | null;
  applicableCriteriaCount: number;
  sectionsCount: number;
  sectionsWithActionPlan: number;
  recommendationsCount: number;
  actionsCount: number;
  averageActionProgress: number | null;
};

export type ReportAxisView = {
  id: string;
  numberLabel: string;
  title: string;
  order: number;
  summary: ReportAxisSummaryView;
  sections: ReportSectionView[];
};

export type ReportDetailedAnalysisView = {
  chapterNumber: number;
  axes: ReportAxisView[];
};

export type OfficialReportData = {
  cycleId: string;
  cycleProcessingId: string;
  organizationId: string;
  formId: string;
  organizationName: string;
  formName: string;
  processingVersion: number;
  policyVersion: string;
  referenceYear: number;
  referenceStartYear: number;
  referenceEndYear: number;
  referencePeriodLabel: string;
  actionPlanRevision: number;
  periodLabel: string;
  famiProcessedAt: string;
  generatedAtIso: string;
  document: ReportDocumentIdentity | null;
  actionPlan: ActionPlanByCyclePayload;
  diagnostic: ReportDiagnostic;
  fami: {
    global: {
      percentage: number;
      maturityLevel: number | null;
      pointsObtained: number;
      pointsPossible: number;
    };
    byAxis: ReportFamiAxisScore[];
    sections: ReportFamiSectionScore[];
  };
  /** Movimentações por id da ação; preenchidas no carregamento do relatório. */
  actionMovementsByActionId: Record<string, ReportActionMovementSource[]>;
  evidence: ReportEvidenceSummary;
  evolution: ReportEvolutionPoint[];
  criticalAxesCount: number;
  advancedAxesCount: number;
  topOpportunityAxis: string | null;
  meta: {
    applicableQuestions: number;
    waivedQuestions: number;
    notApplicableResponses: number;
    isOfficialScore: boolean;
    cycleState: string;
    closedAt: string | null;
    responseDeadlineAt: string | null;
  };
};
