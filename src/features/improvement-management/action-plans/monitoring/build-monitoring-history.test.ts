import { describe, expect, it } from "vitest";
import type { ActionPlanDeadlineChangeRequest, SupervisionNoteEntry } from "../types";
import {
  buildPendingDecisions,
  compareMonitoringTimestamps,
} from "./build-monitoring-history";

function note(over: Partial<SupervisionNoteEntry> = {}): SupervisionNoteEntry {
  return {
    id: "note-1",
    recommendationId: "rec-1",
    actionPlanId: "plan-1",
    actionRevision: 1,
    actionSnapshot: {},
    actionLabel: "Publicar informações no portal",
    noteType: "comment",
    lifecycleStatus: "recorded",
    body: "Acompanhar a publicação.",
    responseBody: null,
    respondedBy: null,
    respondedByName: null,
    respondedAt: null,
    resolutionBody: null,
    resolvedBy: null,
    resolvedByName: null,
    resolvedAt: null,
    createdAt: "2026-08-12T16:20:00Z",
    authorId: "admin-1",
    authorName: "Mauricio",
    authorRole: "admin",
    ...over,
  };
}

function deadline(
  over: Partial<ActionPlanDeadlineChangeRequest> = {},
): ActionPlanDeadlineChangeRequest {
  return {
    id: "dl-1",
    actionPlanId: "plan-1",
    recommendationId: "rec-1",
    organizationId: "org-1",
    actionRevision: 1,
    previousDueDate: "2026-09-30",
    requestedDueDate: "2026-10-31",
    reason: "Necessário prazo adicional.",
    status: "pending",
    requestedBy: "user-1",
    requestedByName: "Ana",
    requestedAt: "2026-08-12T23:11:00Z",
    decidedBy: null,
    decidedByName: null,
    decidedAt: null,
    decisionReason: null,
    appliedActionRevision: null,
    ...over,
  };
}

describe("buildPendingDecisions", () => {
  it("inclui só solicitações de prazo e supervisão ainda abertas", () => {
    const items = buildPendingDecisions({
      notes: [
        note({
          id: "open",
          noteType: "adjustment_request",
          lifecycleStatus: "open",
          createdAt: "2026-08-12T10:00:00Z",
        }),
        note({ id: "done", noteType: "comment", lifecycleStatus: "recorded" }),
      ],
      deadlineRequests: [
        deadline({ id: "wait" }),
        deadline({ id: "ok", status: "approved", decidedAt: "2026-08-13T10:00:00Z" }),
      ],
    });

    expect(items.map((item) => (item.kind === "deadline" ? item.request.id : item.note.id))).toEqual([
      "wait",
      "open",
    ]);
  });

  it("usa o timestamp real, não o texto formatado", () => {
    expect(
      compareMonitoringTimestamps(
        "2026-08-12T09:00:00Z",
        "a",
        "2026-08-12T10:00:00Z",
        "b",
      ),
    ).toBeGreaterThan(0);
  });
});
