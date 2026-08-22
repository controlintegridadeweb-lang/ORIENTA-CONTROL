/**
 * API pública do modelo puro da validação.
 *
 * As responsabilidades são implementadas em módulos menores: contratos,
 * navegação por seção, política de status de evidência e política de decisão.
 */
export type {
  AdminProofStatus,
  EvidenceKind,
  EvidenceVerdict,
  NaQueueStatus,
  QueueEvidence,
  QueueEvidenceGroup,
  QueueNotApplicable,
  QueueProgress,
  QueueSectionItem,
  QueueSectionNavGroup,
  QueueSectionNavigation,
  QueueSectionSummary,
} from "./queue-types";

export {
  ALL_AXES_PARAM,
  ALL_SECTIONS_PARAM,
  axisFormOrder,
  axisPendingCount,
  buildSectionNavigation,
  compareSectionCatalogOrder,
  formSectionsCoverageCaption,
  groupSectionsByAxis,
  pickPreferredSectionIdForAxis,
  resolveSelectedAxisId,
  resolveSelectedSectionId,
  sectionChipStatusLabel,
  sectionSelectorStatusSuffix,
  sectionsForAxis,
} from "./queue-section-navigation";

export {
  absentEvidenceStatusFromProof,
  createAbsentEvidenceShell,
  deriveResponseEvidenceStatus,
} from "./evidence-status-policy";

export {
  DOCUMENT_STATUS_LABEL,
  EVIDENCE_JUSTIFICATION_PRESETS,
  NA_VERDICT_LABEL,
  VERDICT_LABEL,
  answerLabel,
  canSubmitNaVerdict,
  canSubmitVerdict,
  justificationRequired,
} from "./validation-decision-policy";
