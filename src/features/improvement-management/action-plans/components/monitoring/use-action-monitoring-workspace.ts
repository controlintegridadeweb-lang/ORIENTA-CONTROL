"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePatchState } from "@/shared/hooks/use-patch-state";
import { describeError } from "@/infrastructure/notifications/notify";
import {
  listActionPlanAudit,
  listActionPlanProgressUpdates,
  listAdminDeadlineChangeRequests,
  listRespondentActionPlanAudit,
  listRespondentActionPlanProgressUpdates,
  listRespondentDeadlineChangeRequests,
  listRespondentSupervisionNotes,
  listSupervisionNotes,
  type SupervisionHistoryPageInput,
} from "@/features/improvement-management/action-plans/client";
import type {
  ActionPlanAuditEntry,
  ActionPlanDeadlineChangeRequest,
  ActionPlanProgressUpdate,
  SupervisionNoteEntry,
} from "@/features/improvement-management/action-plans/types";
import type { AuditFeedItem } from "@/features/improvement-management/recommendations/components/hub/action-plan-audit-feed";
import {
  buildPendingDecisions,
  isPendingSupervisionNote,
} from "@/features/improvement-management/action-plans/monitoring/build-monitoring-history";

const SUPERVISION_PAGE_SIZE = 100;
const DEADLINE_LIMIT = 50;
const AUDIT_PAGE_SIZE = 20;

type Role = "admin" | "respondent";

type Args = {
  role: Role;
  recommendationId: string | undefined;
  selectedActionId: string | null;
};

type NotesLoader = (
  recommendationId: string,
  page: SupervisionHistoryPageInput,
) => Promise<{ items: SupervisionNoteEntry[]; hasMore: boolean }>;

async function loadPendingSupervisionNotes(
  loader: NotesLoader,
  recommendationId: string,
  actionPlanId: string,
): Promise<SupervisionNoteEntry[]> {
  const items: SupervisionNoteEntry[] = [];
  let offset = 0;
  while (true) {
    const page = await loader(recommendationId, {
      actionPlanId,
      lifecycleStatuses: ["open", "acknowledged"],
      limit: SUPERVISION_PAGE_SIZE,
      offset,
    });
    items.push(...page.items.filter(isPendingSupervisionNote));
    if (!page.hasMore || page.items.length === 0) return items;
    offset += page.items.length;
  }
}

function openRequestActionIdsFromNotes(notes: SupervisionNoteEntry[]): Set<string> {
  return new Set(
    notes
      .filter(isPendingSupervisionNote)
      .map((note) => note.actionPlanId)
      .filter((actionPlanId): actionPlanId is string => Boolean(actionPlanId)),
  );
}

export function useActionMonitoringWorkspace({
  role,
  recommendationId,
  selectedActionId,
}: Args) {
  const [state, patchState] = usePatchState({
    notes: [] as SupervisionNoteEntry[],
    notesError: null as string | null,
    notesLoading: false,
    notesRetry: 0,
    openRequestActionIds: new Set<string>(),
    deadlineRequests: [] as ActionPlanDeadlineChangeRequest[],
    deadlineError: null as string | null,
    deadlineLoading: false,
    deadlineRetry: 0,
    progressUpdates: [] as ActionPlanProgressUpdate[],
    progressError: null as string | null,
    progressLoading: false,
    progressRetry: 0,
    auditEntries: [] as ActionPlanAuditEntry[],
    auditOffset: 0,
    auditTotal: 0,
    auditHasMore: false,
    auditLoading: false,
    auditError: null as string | null,
    auditRetry: 0,
  });

  useEffect(() => {
    patchState({ auditOffset: 0 });
  }, [recommendationId, selectedActionId, patchState]);

  useEffect(() => {
    if (!recommendationId || !selectedActionId) {
      patchState({
        notes: [],
        notesError: null,
        notesLoading: false,
        openRequestActionIds: new Set(),
      });
      return;
    }

    let cancelled = false;
    patchState({
      notes: [],
      notesLoading: true,
      notesError: null,
      openRequestActionIds: new Set(),
    });
    const notesLoader =
      role === "admin" ? listSupervisionNotes : listRespondentSupervisionNotes;

    void loadPendingSupervisionNotes(
      notesLoader,
      recommendationId,
      selectedActionId,
    )
      .then((notes) => {
        if (cancelled) return;
        patchState({
          notes,
          openRequestActionIds: openRequestActionIdsFromNotes(notes),
        });
      })
      .catch((caught) => {
        if (cancelled) return;
        patchState({
          notes: [],
          openRequestActionIds: new Set(),
          notesError: describeError(caught, "Falha ao carregar as pendências da supervisão."),
        });
      })
      .finally(() => {
        if (!cancelled) patchState({ notesLoading: false });
      });

    return () => {
      cancelled = true;
    };
  }, [recommendationId, selectedActionId, role, state.notesRetry, patchState]);

  useEffect(() => {
    if (!selectedActionId) {
      patchState({
        deadlineRequests: [],
        deadlineError: null,
        deadlineLoading: false,
        progressUpdates: [],
        progressError: null,
        progressLoading: false,
      });
      return;
    }

    let cancelled = false;
    patchState({
      deadlineLoading: true,
      deadlineError: null,
      progressLoading: true,
      progressError: null,
    });

    const deadlineLoader =
      role === "admin"
        ? listAdminDeadlineChangeRequests
        : listRespondentDeadlineChangeRequests;
    const progressLoader =
      role === "admin"
        ? listActionPlanProgressUpdates
        : listRespondentActionPlanProgressUpdates;

    void Promise.all([
      deadlineLoader({ planId: selectedActionId, limit: DEADLINE_LIMIT, offset: 0 }),
      progressLoader(selectedActionId),
    ])
      .then(([deadlinePage, progressItems]) => {
        if (cancelled) return;
        patchState({
          deadlineRequests: deadlinePage.items,
          progressUpdates: progressItems,
        });
      })
      .catch((caught) => {
        if (cancelled) return;
        const message = describeError(caught, "Falha ao carregar o acompanhamento.");
        patchState({
          deadlineError: message,
          progressError: message,
        });
      })
      .finally(() => {
        if (!cancelled) {
          patchState({
            deadlineLoading: false,
            progressLoading: false,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedActionId,
    role,
    state.deadlineRetry,
    state.progressRetry,
    patchState,
  ]);

  useEffect(() => {
    if (!selectedActionId) {
      patchState({
        auditEntries: [],
        auditTotal: 0,
        auditHasMore: false,
        auditError: null,
        auditLoading: false,
      });
      return;
    }
    let cancelled = false;
    patchState({ auditLoading: true, auditError: null });
    const loader = role === "admin" ? listActionPlanAudit : listRespondentActionPlanAudit;
    void loader(selectedActionId, {
      limit: AUDIT_PAGE_SIZE,
      offset: state.auditOffset,
    })
      .then((page) => {
        if (cancelled) return;
        patchState({
          auditEntries: page.items,
          auditTotal: page.total,
          auditHasMore: page.hasMore,
        });
      })
      .catch((caught) => {
        if (!cancelled) {
          patchState({
            auditError: describeError(caught, "Falha ao carregar a auditoria da ação."),
          });
        }
      })
      .finally(() => {
        if (!cancelled) patchState({ auditLoading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedActionId, role, state.auditOffset, state.auditRetry, patchState]);

  const actionNotes = state.notes;

  const pendingItems = useMemo(
    () =>
      buildPendingDecisions({
        notes: actionNotes,
        deadlineRequests: state.deadlineRequests,
      }),
    [actionNotes, state.deadlineRequests],
  );

  const auditFeedItems = useMemo<AuditFeedItem[]>(
    () =>
      state.auditEntries.map((entry) => ({
        id: entry.id,
        entry,
      })),
    [state.auditEntries],
  );

  const operationalLoading =
    (state.notesLoading && state.notes.length === 0)
    || (state.deadlineLoading && state.deadlineRequests.length === 0)
    || (state.progressLoading && state.progressUpdates.length === 0);
  const operationalError = state.notesError ?? state.deadlineError ?? state.progressError;

  const retryOperational = useCallback(() => {
    patchState((current) => ({
      notesRetry: current.notesRetry + 1,
      deadlineRetry: current.deadlineRetry + 1,
      progressRetry: current.progressRetry + 1,
    }));
  }, [patchState]);

  return {
    openRequestActionIds: state.openRequestActionIds,
    supervisionLoading: state.notesLoading,
    supervisionError: state.notesError,
    pendingItems,
    progressUpdates: state.progressUpdates,
    operationalLoading,
    operationalError,
    retryOperational,
    auditFeedItems,
    auditLoading: state.auditLoading,
    auditError: state.auditError,
    auditTotal: state.auditTotal,
    auditOffset: state.auditOffset,
    auditHasMore: state.auditHasMore,
    auditPageSize: AUDIT_PAGE_SIZE,
    retryAudit: () => patchState((current) => ({ auditRetry: current.auditRetry + 1 })),
    previousAuditPage: () =>
      patchState((current) => ({
        auditOffset: Math.max(0, current.auditOffset - AUDIT_PAGE_SIZE),
      })),
    nextAuditPage: () =>
      patchState((current) => ({
        auditOffset: current.auditOffset + AUDIT_PAGE_SIZE,
      })),
    replaceNote: (updated: SupervisionNoteEntry) => {
      patchState((current) => {
        const notes = isPendingSupervisionNote(updated)
          ? current.notes.map((note) => (note.id === updated.id ? updated : note))
          : current.notes.filter((note) => note.id !== updated.id);
        if (isPendingSupervisionNote(updated) && !notes.some((note) => note.id === updated.id)) {
          notes.unshift(updated);
        }
        return {
          notes,
          openRequestActionIds: openRequestActionIdsFromNotes(notes),
        };
      });
    },
    prependNote: (created: SupervisionNoteEntry) => {
      if (!isPendingSupervisionNote(created)) return;
      patchState((current) => {
        const notes = [created, ...current.notes.filter((note) => note.id !== created.id)];
        return {
          notes,
          openRequestActionIds: openRequestActionIdsFromNotes(notes),
        };
      });
    },
    replaceDeadline: (updated: ActionPlanDeadlineChangeRequest) => {
      patchState((current) => ({
        deadlineRequests: current.deadlineRequests.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      }));
    },
    refreshOpenRequests: async () => {
      if (!recommendationId || !selectedActionId) return;
      const notesLoader =
        role === "admin" ? listSupervisionNotes : listRespondentSupervisionNotes;
      const notes = await loadPendingSupervisionNotes(
        notesLoader,
        recommendationId,
        selectedActionId,
      );
      patchState({
        notes,
        openRequestActionIds: openRequestActionIdsFromNotes(notes),
      });
    },
  };
}
