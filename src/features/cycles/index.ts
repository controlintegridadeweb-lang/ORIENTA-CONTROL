/**
 * API pública client-safe do domínio cycles.
 * Contratos de servidor ficam em `./server` (server-only).
 */
export {
  consolidateAdminCycleValidation,
  decideAdminProofAction,
  dispatchAdminEvidenceAdjustments,
  markAdminNotApplicableAction,
  markAdminNotApplicableBatch,
  revertAdminNotApplicableAction,
  saveValidationAnalysisDraftAction,
  updateAdminCycleReferencePeriod,
  validateEvidenceAction,
  validateQueueBatch,
  validateNotApplicableAction,
} from "./client";
