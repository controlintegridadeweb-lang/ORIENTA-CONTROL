import type {
  ActionPlanDeadlineChangeRequest,
  SupervisionNoteEntry,
} from "@/features/improvement-management/action-plans/types";

export type PendingMonitoringItem =
  | { kind: "deadline"; occurredAt: string; request: ActionPlanDeadlineChangeRequest }
  | { kind: "supervision"; occurredAt: string; note: SupervisionNoteEntry };

export function isPendingSupervisionNote(note: SupervisionNoteEntry): boolean {
  return (
    ["open", "acknowledged"].includes(note.lifecycleStatus)
    && ["adjustment_request", "pending"].includes(note.noteType)
  );
}

/** Aceite vigente da revisão atual — decisão exibida em "Pendências e decisões". */
export function isEffectiveApprovalNote(note: SupervisionNoteEntry): boolean {
  return note.noteType === "approval" && note.lifecycleStatus === "effective";
}

export function isMonitoringDecisionNote(note: SupervisionNoteEntry): boolean {
  return isPendingSupervisionNote(note) || isEffectiveApprovalNote(note);
}

export function isPendingDeadlineRequest(
  request: ActionPlanDeadlineChangeRequest,
): boolean {
  return request.status === "pending";
}

export function compareMonitoringTimestamps(
  leftAt: string,
  leftId: string,
  rightAt: string,
  rightId: string,
): number {
  const byTime = rightAt.localeCompare(leftAt);
  if (byTime !== 0) return byTime;
  return leftId.localeCompare(rightId);
}

function pendingId(item: PendingMonitoringItem): string {
  return item.kind === "deadline" ? item.request.id : item.note.id;
}

export function buildPendingDecisions(sources: {
  notes: SupervisionNoteEntry[];
  deadlineRequests: ActionPlanDeadlineChangeRequest[];
}): PendingMonitoringItem[] {
  const items: PendingMonitoringItem[] = [];
  for (const request of sources.deadlineRequests) {
    if (!isPendingDeadlineRequest(request)) continue;
    items.push({ kind: "deadline", occurredAt: request.requestedAt, request });
  }
  for (const note of sources.notes) {
    if (!isMonitoringDecisionNote(note)) continue;
    items.push({ kind: "supervision", occurredAt: note.createdAt, note });
  }
  items.sort((left, right) =>
    compareMonitoringTimestamps(left.occurredAt, pendingId(left), right.occurredAt, pendingId(right)),
  );
  return items;
}
