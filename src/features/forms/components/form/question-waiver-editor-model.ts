import type { QuestionWaiverRow } from "@/features/forms/waiver-client";

export type DesiredQuestionWaiver = {
  organizationId: string;
  reason: string | null;
};

export type WaiverReasonState = {
  displayedReason: string;
  hasMixedReasons: boolean;
};

function normalizeReason(reason: string | null | undefined): string | null {
  const normalized = reason?.trim() ?? "";
  return normalized || null;
}

export function deriveWaiverReasonState(
  current: Map<string, QuestionWaiverRow>,
): WaiverReasonState {
  const reasons = [...current.values()].map((waiver) =>
    normalizeReason(waiver.reason),
  );
  const uniqueReasons = [...new Set(reasons)];

  return {
    displayedReason:
      uniqueReasons.length === 1 ? (uniqueReasons[0] ?? "") : "",
    hasMixedReasons: uniqueReasons.length > 1,
  };
}

export function buildDesiredQuestionWaivers(input: {
  current: Map<string, QuestionWaiverRow>;
  selectedOrganizationIds: Set<string>;
  displayedReason: string;
  reasonTouched: boolean;
}): DesiredQuestionWaiver[] {
  const enteredReason = normalizeReason(input.displayedReason);
  const initialReasonState = deriveWaiverReasonState(input.current);
  const reasonForNewOrganization = input.reasonTouched
    ? enteredReason
    : normalizeReason(initialReasonState.displayedReason);

  return [...input.selectedOrganizationIds]
    .sort((a, b) => a.localeCompare(b))
    .map((organizationId) => {
      const existing = input.current.get(organizationId);
      return {
        organizationId,
        reason: input.reasonTouched
          ? enteredReason
          : existing
            ? normalizeReason(existing.reason)
            : reasonForNewOrganization,
      };
    });
}

export function waiverReplacementChanged(
  current: Map<string, QuestionWaiverRow>,
  desired: DesiredQuestionWaiver[],
): boolean {
  if (current.size !== desired.length) return true;

  return desired.some((waiver) => {
    const existing = current.get(waiver.organizationId);
    return !existing || normalizeReason(existing.reason) !== waiver.reason;
  });
}
