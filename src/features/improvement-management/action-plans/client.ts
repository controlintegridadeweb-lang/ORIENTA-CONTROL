import type {
  ActionPlanAuditEntry,
  ActionPlanListItem,
  ActionPlanProgressUpdate,
  PaginatedHistory,
  SupervisionNoteEntry,
  RecommendationActionPlanAuditEntry,
  ActionPlanResponsibleMember,
  ActionPlanDeadlineChangeRequest,
} from "./types";
import type { ActionPlanDocument } from "./domain-model";
import type {
  RespondentActionCommand,
  SupervisionLifecycleStatus,
  SupervisionNoteComposerType,
} from "./schemas";
import type { ActionPlanCompletionReadiness } from "./completion-readiness-model";
import { apiErrorSchema, buildHeaders, formatError, parseJson } from "@/infrastructure/api/fetch-client";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser";
import {
  actionPlanAuditPageSchema,
  actionPlanItemResponseSchema,
  deletePlanResponseSchema,
  recommendationAuditPageSchema,
  responsibleMembersResponseSchema,
  savePlanResponseSchema,
  supervisionNoteResponseSchema,
  supervisionNotesPageSchema,
  actionPlanDocumentResponseSchema,
  actionPlanDocumentUploadInitializationSchema,
  actionPlanDocumentUploadDiscardResponseSchema,
  actionPlanDocumentDeleteResponseSchema,
  deadlineChangeRequestsPageSchema,
  deadlineChangeRequestResponseSchema,
  actionPlanProgressUpdatesResponseSchema,
  actionPlanCompletionReadinessResponseSchema,
} from "@/features/improvement-management/client-contracts";

export {
  listAdminActionPlans,
  listAllActionPlansForCycle,
  listRespondentActionPlans,
  type ListActionPlansFilters,
} from "./list-client";

async function getActionPlanByRecommendation(
  profile: "admin" | "respondent",
  recommendationId: string,
): Promise<ActionPlanListItem | null> {
  const res = await fetch(
    `/api/${profile}/action-plans/recommendations/${encodeURIComponent(recommendationId)}`,
    { headers: buildHeaders() },
  );
  const body = await parseJson(res, actionPlanItemResponseSchema);
  if (!res.ok) throw new Error(formatError(body));
  return body.item ?? null;
}

export function getAdminActionPlanByRecommendation(
  recommendationId: string,
): Promise<ActionPlanListItem | null> {
  return getActionPlanByRecommendation("admin", recommendationId);
}

export function getRespondentActionPlanByRecommendation(
  recommendationId: string,
): Promise<ActionPlanListItem | null> {
  return getActionPlanByRecommendation("respondent", recommendationId);
}

export async function getAdminRecommendationActionPlanCompletionReadiness(
  recommendationId: string,
): Promise<ActionPlanCompletionReadiness> {
  const res = await fetch(
    `/api/admin/action-plans/recommendations/${encodeURIComponent(recommendationId)}/completion-readiness`,
    { headers: buildHeaders() },
  );
  const body = await parseJson(res, actionPlanCompletionReadinessResponseSchema);
  if (!res.ok || !body.readiness) throw new Error(formatError(body));
  return body.readiness;
}

export type { ActionPlanResponsibleMember } from "./types";

export async function listActionPlanResponsibleMembers(): Promise<ActionPlanResponsibleMember[]> {
  const res = await fetch("/api/respondent/action-plans/responsibles", {
    headers: buildHeaders(),
  });
  const body = await parseJson(res, responsibleMembersResponseSchema);
  if (!res.ok || !Array.isArray(body.items)) throw new Error(formatError(body));
  return body.items;
}

export async function saveRespondentActionPlan(
  payload: RespondentActionCommand,
): Promise<{ planId: string; mode: "created" | "updated"; revision: number }> {
  const res = await fetch("/api/respondent/action-plans", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await parseJson(res, savePlanResponseSchema);
  const revision = body.revision;
  if (
    !res.ok ||
    !body.planId ||
    typeof revision !== "number" ||
    !Number.isInteger(revision) ||
    (body.mode !== "created" && body.mode !== "updated")
  ) {
    throw new Error(formatError(body));
  }
  return { planId: body.planId, mode: body.mode, revision };
}

export async function createRespondentActionPlan(
  payload: Extract<RespondentActionCommand, { intent: "create" }>,
) {
  return saveRespondentActionPlan(payload);
}

export async function updateRespondentActionProgress(
  payload: Extract<RespondentActionCommand, { intent: "update_progress" }>,
) {
  return saveRespondentActionPlan(payload);
}

export async function editRespondentActionDetails(
  payload: Extract<RespondentActionCommand, { intent: "edit_details" }>,
) {
  return saveRespondentActionPlan(payload);
}

export async function listRespondentDeadlineChangeRequests(params: {
  recommendationId?: string;
  planId?: string;
  status?: "pending" | "approved" | "rejected";
  limit?: number;
  offset?: number;
} = {}): Promise<PaginatedHistory<ActionPlanDeadlineChangeRequest>> {
  return listDeadlineChangeRequests("/api/respondent/action-plans/deadline-change-requests", params);
}

export async function requestRespondentDeadlineChange(payload: {
  planId: string;
  recommendationId: string;
  expectedRevision: number;
  requestedDueDate: string;
  reason: string;
}): Promise<ActionPlanDeadlineChangeRequest> {
  const res = await fetch("/api/respondent/action-plans/deadline-change-requests", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await parseJson(res, deadlineChangeRequestResponseSchema);
  if (!res.ok || !body.deadlineChange) throw new Error(formatError(body));
  return body.deadlineChange;
}

export async function listAdminDeadlineChangeRequests(params: {
  recommendationId?: string;
  planId?: string;
  status?: "pending" | "approved" | "rejected";
  limit?: number;
  offset?: number;
} = {}): Promise<PaginatedHistory<ActionPlanDeadlineChangeRequest>> {
  return listDeadlineChangeRequests("/api/admin/action-plans/deadline-change-requests", params);
}

async function listDeadlineChangeRequests(
  endpoint: string,
  params: {
    recommendationId?: string;
    planId?: string;
    status?: "pending" | "approved" | "rejected";
    limit?: number;
    offset?: number;
  },
): Promise<PaginatedHistory<ActionPlanDeadlineChangeRequest>> {
  const search = new URLSearchParams();
  if (params.recommendationId) search.set("recommendationId", params.recommendationId);
  if (params.planId) search.set("planId", params.planId);
  if (params.status) search.set("status", params.status);
  if (typeof params.limit === "number") search.set("limit", String(params.limit));
  if (typeof params.offset === "number") search.set("offset", String(params.offset));
  const res = await fetch(`${endpoint}?${search.toString()}`, { headers: buildHeaders() });
  const body = await parseJson(res, deadlineChangeRequestsPageSchema);
  if (!res.ok || !Array.isArray(body.items)) throw new Error(formatError(body));
  return body;
}

export async function decideAdminDeadlineChange(payload: {
  requestId: string;
  decision: "approved" | "rejected";
  decisionReason: string;
}): Promise<ActionPlanDeadlineChangeRequest> {
  const res = await fetch("/api/admin/action-plans/deadline-change-requests", {
    method: "PATCH",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await parseJson(res, deadlineChangeRequestResponseSchema);
  if (!res.ok || !body.deadlineChange) throw new Error(formatError(body));
  return body.deadlineChange;
}

export async function cancelRespondentActionPlan(
  payload: Extract<RespondentActionCommand, { intent: "cancel" }>,
) {
  return saveRespondentActionPlan(payload);
}

export async function addActionPlanDocumentLink(payload: {
  planId: string;
  expectedRevision: number;
  title: string;
  externalLink: string;
}): Promise<ActionPlanDocument> {
  const res = await fetch(
    `/api/respondent/action-plans/${encodeURIComponent(payload.planId)}/documents`,
    {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({
        kind: "link",
        expectedRevision: payload.expectedRevision,
        title: payload.title,
        externalLink: payload.externalLink,
      }),
    },
  );
  if (!res.ok) {
    const errorBody = await parseJson(res, apiErrorSchema);
    throw new Error(formatError(errorBody));
  }
  const body = await parseJson(res, actionPlanDocumentResponseSchema);
  return body.document;
}

export async function addActionPlanDocumentFile(payload: {
  planId: string;
  expectedRevision: number;
  title: string;
  file: File;
}): Promise<ActionPlanDocument> {
  const endpoint = `/api/respondent/action-plans/${encodeURIComponent(payload.planId)}/documents`;
  const initializationResponse = await fetch(endpoint, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      kind: "file",
      expectedRevision: payload.expectedRevision,
      title: payload.title,
      filename: payload.file.name,
      mimeType: payload.file.type || null,
      sizeBytes: payload.file.size,
    }),
  });
  if (!initializationResponse.ok) {
    const errorBody = await parseJson(initializationResponse, apiErrorSchema);
    throw new Error(formatError(errorBody));
  }
  const initialized = await parseJson(
    initializationResponse,
    actionPlanDocumentUploadInitializationSchema,
  );

  const supabase = createSupabaseBrowserClient();
  const { error: uploadError } = await supabase.storage
    .from(initialized.bucket)
    .uploadToSignedUrl(
      initialized.storagePath,
      initialized.uploadToken,
      payload.file,
      {
        contentType: payload.file.type || "application/octet-stream",
        upsert: false,
      },
    );
  if (uploadError) {
    await fetch(endpoint, {
      method: "DELETE",
      headers: buildHeaders(),
      body: JSON.stringify({ pendingUploadId: initialized.pendingUploadId }),
    }).then(async (response) => {
      if (response.ok) {
        await parseJson(response, actionPlanDocumentUploadDiscardResponseSchema);
      }
    }).catch(() => undefined);
    throw new Error("Não foi possível enviar o arquivo de comprovação.");
  }

  const confirmationBody = JSON.stringify({
    expectedRevision: payload.expectedRevision,
    pendingUploadId: initialized.pendingUploadId,
  });
  const confirm = () => fetch(endpoint, {
    method: "PATCH",
    headers: buildHeaders(),
    body: confirmationBody,
  });

  let confirmationResponse: Response;
  try {
    confirmationResponse = await confirm();
  } catch {
    confirmationResponse = await confirm();
  }
  if (!confirmationResponse.ok && confirmationResponse.status >= 500) {
    confirmationResponse = await confirm();
  }
  if (!confirmationResponse.ok) {
    const errorBody = await parseJson(confirmationResponse, apiErrorSchema);
    throw new Error(formatError(errorBody));
  }
  const body = await parseJson(confirmationResponse, actionPlanDocumentResponseSchema);
  return body.document;
}

export async function removeActionPlanDocument(payload: {
  planId: string;
  documentId: string;
  expectedRevision: number;
  reason: string;
}): Promise<void> {
  const res = await fetch(
    `/api/respondent/action-plans/${encodeURIComponent(payload.planId)}/documents/${encodeURIComponent(payload.documentId)}`,
    {
      method: "DELETE",
      headers: buildHeaders(),
      body: JSON.stringify({
        expectedRevision: payload.expectedRevision,
        reason: payload.reason,
      }),
    },
  );
  const body = await parseJson(res, actionPlanDocumentDeleteResponseSchema);
  if (!res.ok || !body.ok) throw new Error(formatError(body));
}

export async function deleteRespondentActionPlan(payload: {
  planId: string;
  recommendationId: string;
  expectedRevision: number;
}): Promise<{ planId: string; mode: "deleted"; revision: number }> {
  const params = new URLSearchParams({
    recommendationId: payload.recommendationId,
    expectedRevision: String(payload.expectedRevision),
  });
  const res = await fetch(
    `/api/respondent/action-plans/${encodeURIComponent(payload.planId)}?${params}`,
    {
      method: "DELETE",
      headers: buildHeaders(),
    },
  );
  const body = await parseJson(res, deletePlanResponseSchema);
  const revision = body.revision;
  if (
    !res.ok ||
    !body.planId ||
    typeof revision !== "number" ||
    !Number.isInteger(revision) ||
    body.mode !== "deleted"
  ) {
    throw new Error(formatError(body));
  }
  return { planId: body.planId, mode: body.mode, revision };
}

export type HistoryPageInput = { limit?: number; offset?: number };
export type SupervisionHistoryPageInput = HistoryPageInput & {
  actionPlanId?: string;
  lifecycleStatuses?: SupervisionLifecycleStatus[];
};

function historyQuery(input: HistoryPageInput): string {
  const params = new URLSearchParams();
  if (typeof input.limit === "number") params.set("limit", String(input.limit));
  if (typeof input.offset === "number") params.set("offset", String(input.offset));
  const value = params.toString();
  return value ? `?${value}` : "";
}

export async function listActionPlanAudit(
  planId: string,
  page: HistoryPageInput = {},
): Promise<PaginatedHistory<ActionPlanAuditEntry>> {
  const res = await fetch(`/api/admin/action-plans/${planId}/audit${historyQuery(page)}`, {
    headers: buildHeaders(),
  });
  const body = await parseJson(res, actionPlanAuditPageSchema);
  if (!res.ok || !Array.isArray(body.items)) throw new Error(formatError(body));
  return body;
}

export async function listRespondentActionPlanAudit(
  planId: string,
  page: HistoryPageInput = {},
): Promise<PaginatedHistory<ActionPlanAuditEntry>> {
  const res = await fetch(`/api/respondent/action-plans/${planId}/audit${historyQuery(page)}`, {
    headers: buildHeaders(),
  });
  const body = await parseJson(res, actionPlanAuditPageSchema);
  if (!res.ok || !Array.isArray(body.items)) throw new Error(formatError(body));
  return body;
}

async function listPlanProgressUpdates(
  endpoint: string,
): Promise<ActionPlanProgressUpdate[]> {
  const res = await fetch(endpoint, { headers: buildHeaders() });
  const body = await parseJson(res, actionPlanProgressUpdatesResponseSchema);
  if (!res.ok || !Array.isArray(body.items)) throw new Error(formatError(body));
  return body.items;
}

export function listActionPlanProgressUpdates(
  planId: string,
): Promise<ActionPlanProgressUpdate[]> {
  return listPlanProgressUpdates(
    `/api/admin/action-plans/${encodeURIComponent(planId)}/progress-updates`,
  );
}

export function listRespondentActionPlanProgressUpdates(
  planId: string,
): Promise<ActionPlanProgressUpdate[]> {
  return listPlanProgressUpdates(
    `/api/respondent/action-plans/${encodeURIComponent(planId)}/progress-updates`,
  );
}


export async function listRecommendationActionPlanAudit(
  recommendationId: string,
  page: HistoryPageInput = {},
): Promise<PaginatedHistory<RecommendationActionPlanAuditEntry>> {
  const res = await fetch(
    `/api/admin/action-plans/recommendations/${encodeURIComponent(recommendationId)}/audit${historyQuery(page)}`,
    { headers: buildHeaders() },
  );
  const body = await parseJson(res, recommendationAuditPageSchema);
  if (!res.ok || !Array.isArray(body.items)) throw new Error(formatError(body));
  return body;
}

export async function listRespondentRecommendationActionPlanAudit(
  recommendationId: string,
  page: HistoryPageInput = {},
): Promise<PaginatedHistory<RecommendationActionPlanAuditEntry>> {
  const res = await fetch(
    `/api/respondent/action-plans/recommendations/${encodeURIComponent(recommendationId)}/audit${historyQuery(page)}`,
    { headers: buildHeaders() },
  );
  const body = await parseJson(res, recommendationAuditPageSchema);
  if (!res.ok || !Array.isArray(body.items)) throw new Error(formatError(body));
  return body;
}

export async function listSupervisionNotes(
  recommendationId: string,
  page: SupervisionHistoryPageInput = {},
): Promise<PaginatedHistory<SupervisionNoteEntry>> {
  const params = new URLSearchParams({ recommendationId });
  if (page.actionPlanId) params.set("actionPlanId", page.actionPlanId);
  if (typeof page.limit === "number") params.set("limit", String(page.limit));
  if (typeof page.offset === "number") params.set("offset", String(page.offset));
  for (const status of page.lifecycleStatuses ?? []) {
    params.append("lifecycleStatus", status);
  }
  const res = await fetch(`/api/admin/action-plans/supervision-notes?${params}`, {
    headers: buildHeaders(),
  });
  const body = await parseJson(res, supervisionNotesPageSchema);
  if (!res.ok || !Array.isArray(body.items)) throw new Error(formatError(body));
  return body;
}

export async function listRespondentSupervisionNotes(
  recommendationId: string,
  page: SupervisionHistoryPageInput = {},
): Promise<PaginatedHistory<SupervisionNoteEntry>> {
  const params = new URLSearchParams({ recommendationId });
  if (page.actionPlanId) params.set("actionPlanId", page.actionPlanId);
  if (typeof page.limit === "number") params.set("limit", String(page.limit));
  if (typeof page.offset === "number") params.set("offset", String(page.offset));
  for (const status of page.lifecycleStatuses ?? []) {
    params.append("lifecycleStatus", status);
  }
  const res = await fetch(`/api/respondent/action-plans/supervision-notes?${params}`, {
    headers: buildHeaders(),
  });
  const body = await parseJson(res, supervisionNotesPageSchema);
  if (!res.ok || !Array.isArray(body.items)) throw new Error(formatError(body));
  return body;
}

export async function createSupervisionNote(payload: {
  recommendationId: string;
  actionPlanId?: string;
  noteType: SupervisionNoteComposerType;
  body: string;
}): Promise<SupervisionNoteEntry> {
  const res = await fetch("/api/admin/action-plans/supervision-notes", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await parseJson(res, supervisionNoteResponseSchema);
  if (!res.ok || !body.note) throw new Error(formatError(body));
  return body.note;
}



export async function respondToSupervisionRequest(payload: {
  noteId: string;
  responseBody: string;
}): Promise<SupervisionNoteEntry> {
  const res = await fetch("/api/respondent/action-plans/supervision-notes", {
    method: "PATCH",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await parseJson(res, supervisionNoteResponseSchema);
  if (!res.ok || !body.note) throw new Error(formatError(body));
  return body.note;
}

export async function decideSupervisionRequest(payload: {
  noteId: string;
  decision: "resolved" | "cancelled";
  resolutionBody: string;
}): Promise<SupervisionNoteEntry> {
  const res = await fetch("/api/admin/action-plans/supervision-notes", {
    method: "PATCH",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await parseJson(res, supervisionNoteResponseSchema);
  if (!res.ok || !body.note) throw new Error(formatError(body));
  return body.note;
}
export type { SupervisionNoteEntry };
