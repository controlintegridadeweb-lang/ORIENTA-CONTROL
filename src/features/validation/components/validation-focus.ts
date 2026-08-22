import type { UnifiedFormCriterion } from "../contracts";

export function focusCriterion(responseId: string): boolean {
  const element = document.getElementById(`criterion-${responseId}`);
  if (!element) return false;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
  element.focus({ preventScroll: true });
  return true;
}

export function focusFirstPendingCriterion(
  criteria: UnifiedFormCriterion[],
): boolean {
  const next = criteria.find((criterion) => criterion.awaitsAdminAction);
  return next ? focusCriterion(next.responseId) : false;
}
