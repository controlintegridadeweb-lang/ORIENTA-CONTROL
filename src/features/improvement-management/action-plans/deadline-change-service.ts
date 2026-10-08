import type { SupabaseClient } from "@supabase/supabase-js";
import { DomainConflictError } from "@/infrastructure/api/domain-errors";
import { displayNameFromProfile } from "@/infrastructure/auth/profile-types";
import { isGlobalAdmin } from "@/infrastructure/auth/scope";
import { logInfo } from "@/infrastructure/observability/logger";
import {
  ActionPlansNotFoundError,
  ActionPlansValidationError,
  parseOrThrow,
  type Caller,
} from "./access";
import {
  decideActionPlanDeadlineChangeSchema,
  listActionPlanDeadlineChangesQuerySchema,
  requestActionPlanDeadlineChangeSchema,
  type DeadlineChangeStatus,
} from "./schemas";
import type {
  ActionPlanDeadlineChangeRequest,
  PaginatedHistory,
} from "./types";

const SELECT =
  "id, action_plan_id, recommendation_id, organization_id, action_revision, change_target, previous_due_date, requested_due_date, previous_start_date, requested_start_date, reason, status, requested_by, requested_at, decided_by, decided_at, decision_reason, applied_action_revision";

type DeadlineChangeRow = {
  id: string;
  action_plan_id: string;
  recommendation_id: string;
  organization_id: string;
  action_revision: number;
  change_target?: "due_date" | "start_date" | null;
  previous_due_date?: string | null;
  requested_due_date?: string | null;
  previous_start_date?: string | null;
  requested_start_date?: string | null;
  reason: string;
  status: DeadlineChangeStatus;
  requested_by: string;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  applied_action_revision: number | null;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return "";
}

function mapDeadlineChangeError(error: unknown): never {
  const message = errorMessage(error);
  const conflicts: Array<[string, string]> = [
    ["action_plan_deadline_change_pending_exists", "Já existe uma solicitação de alteração do final aguardando decisão para esta ação."],
    ["action_plan_start_date_change_pending_exists", "Já existe uma solicitação de alteração do início aguardando decisão para esta ação."],
    ["action_plan_deadline_change_revision_conflict", "A ação foi alterada em outra aba. Atualize a página antes de solicitar a alteração."],
    ["action_plan_deadline_change_already_decided", "Esta solicitação já recebeu uma decisão administrativa."],
    ["action_plan_deadline_change_stale_request", "O final vigente da ação mudou depois desta solicitação. Ela não pode mais ser aprovada."],
    ["action_plan_start_date_change_stale_request", "O início vigente da ação mudou depois desta solicitação. Ela não pode mais ser aprovada."],
    ["action_plan_deadline_change_cycle_not_editable", "O diagnóstico não está em um estado que permita alterar o plano de integridade e compliance."],
    ["action_plan_deadline_change_action_closed", "Ações concluídas ou canceladas não podem ter o prazo alterado."],
  ];
  for (const [needle, userMessage] of conflicts) {
    if (message.includes(needle)) throw new DomainConflictError(userMessage);
  }

  const validations: Array<[string, string, string]> = [
    ["action_plan_deadline_change_reason_required", "reason", "Informe uma justificativa para a alteração do final."],
    ["action_plan_deadline_change_decision_reason_required", "decisionReason", "Informe a justificativa da decisão administrativa."],
    ["action_plan_deadline_change_same_date", "requestedDueDate", "O novo final deve ser diferente do final vigente."],
    ["action_plan_deadline_change_before_start", "requestedDueDate", "O novo final não pode ser anterior ao início da ação."],
    ["action_plan_start_date_change_same_date", "requestedStartDate", "O novo início deve ser diferente do início vigente."],
    ["action_plan_start_date_change_after_due", "requestedStartDate", "O novo início não pode ser posterior ao final da ação."],
    ["action_plan_deadline_change_invalid_decision", "decision", "Decisão inválida para a solicitação de alteração do final."],
    ["action_plan_deadline_change_invalid_request", "_", "Dados inválidos para a solicitação de alteração do final."],
  ];
  for (const [needle, path, userMessage] of validations) {
    if (message.includes(needle)) {
      throw new ActionPlansValidationError([{ path, message: userMessage }]);
    }
  }

  if (
    message.includes("action_plan_deadline_change_action_not_found") ||
    message.includes("action_plan_deadline_change_request_not_found")
  ) {
    throw new ActionPlansNotFoundError("Solicitação ou ação não encontrada.");
  }

  throw error;
}

async function loadNames(
  client: SupabaseClient,
  rows: DeadlineChangeRow[],
): Promise<Map<string, string>> {
  const ids = Array.from(
    new Set(
      rows
        .flatMap((row) => [row.requested_by, row.decided_by])
        .filter((value): value is string => Boolean(value)),
    ),
  );
  if (ids.length === 0) return new Map();

  const { data, error } = await client
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", ids);
  if (error) throw error;

  return new Map(
    (data ?? []).map((profile) => [
      String(profile.user_id),
      displayNameFromProfile((profile.full_name as string | null) ?? null, null),
    ]),
  );
}

function localDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function mapRow(
  row: DeadlineChangeRow,
  names: Map<string, string>,
): ActionPlanDeadlineChangeRequest {
  return {
    id: row.id,
    actionPlanId: row.action_plan_id,
    recommendationId: row.recommendation_id,
    organizationId: row.organization_id,
    actionRevision: Number(row.action_revision),
    changeTarget: row.change_target === "start_date" ? "start_date" : "due_date",
    previousDueDate: localDate(row.previous_due_date),
    requestedDueDate: localDate(row.requested_due_date),
    previousStartDate: localDate(row.previous_start_date),
    requestedStartDate: localDate(row.requested_start_date),
    reason: row.reason,
    status: row.status,
    requestedBy: row.requested_by,
    requestedByName: names.get(row.requested_by) ?? "Respondente",
    requestedAt: row.requested_at,
    decidedBy: row.decided_by,
    decidedByName: row.decided_by
      ? names.get(row.decided_by) ?? "Administrador"
      : null,
    decidedAt: row.decided_at,
    decisionReason: row.decision_reason,
    appliedActionRevision:
      row.applied_action_revision == null ? null : Number(row.applied_action_revision),
  };
}

function normalizeRpcRow(data: unknown): DeadlineChangeRow | null {
  if (!data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" ? (row as DeadlineChangeRow) : null;
}

export async function listActionPlanDeadlineChangeRequests(
  client: SupabaseClient,
  rawQuery: unknown,
  caller: Caller,
): Promise<PaginatedHistory<ActionPlanDeadlineChangeRequest>> {
  const query = parseOrThrow(listActionPlanDeadlineChangesQuerySchema, rawQuery);
  let request = client
    .from("action_plan_deadline_change_requests")
    .select(SELECT, { count: "exact" })
    .order("requested_at", { ascending: false })
    .range(query.offset, query.offset + query.limit - 1);

  if (!isGlobalAdmin(caller)) {
    if (!caller.organizationId) {
      throw new ActionPlansNotFoundError("Organização não encontrada.");
    }
    request = request.eq("organization_id", caller.organizationId);
  }
  if (query.recommendationId) request = request.eq("recommendation_id", query.recommendationId);
  if (query.planId) request = request.eq("action_plan_id", query.planId);
  if (query.status) request = request.eq("status", query.status);
  if (query.target) request = request.eq("change_target", query.target);

  const { data, error, count } = await request;
  if (error) throw error;
  const rows = (data ?? []) as DeadlineChangeRow[];
  const names = await loadNames(client, rows);
  const total = count ?? 0;
  return {
    items: rows.map((row) => mapRow(row, names)),
    total,
    limit: query.limit,
    offset: query.offset,
    hasMore: query.offset + rows.length < total,
  };
}

export async function requestActionPlanDeadlineChange(
  client: SupabaseClient,
  rawPayload: unknown,
  caller: { userId: string; organizationId: string },
): Promise<ActionPlanDeadlineChangeRequest> {
  const payload = parseOrThrow(requestActionPlanDeadlineChangeSchema, rawPayload);
  const isStart = payload.target === "start_date";
  const requestedDate = isStart ? payload.requestedStartDate : payload.requestedDueDate;
  if (!requestedDate) {
    throw new ActionPlansValidationError([
      {
        path: isStart ? "requestedStartDate" : "requestedDueDate",
        message: isStart ? "Informe o novo início." : "Informe o novo final.",
      },
    ]);
  }
  const { data, error } = isStart
    ? await client.rpc("request_action_plan_start_date_change", {
        p_actor_user_id: caller.userId,
        p_organization_id: caller.organizationId,
        p_plan_id: payload.planId,
        p_recommendation_id: payload.recommendationId,
        p_requested_start_date: requestedDate,
        p_reason: payload.reason,
        p_expected_revision: payload.expectedRevision,
      })
    : await client.rpc("request_action_plan_deadline_change", {
        p_actor_user_id: caller.userId,
        p_organization_id: caller.organizationId,
        p_plan_id: payload.planId,
        p_recommendation_id: payload.recommendationId,
        p_requested_due_date: requestedDate,
        p_reason: payload.reason,
        p_expected_revision: payload.expectedRevision,
      });
  if (error) mapDeadlineChangeError(error);
  const row = normalizeRpcRow(data);
  if (!row) {
    throw new Error(
      isStart
        ? "A solicitação de alteração do início não foi retornada pelo banco."
        : "A solicitação de alteração do final não foi retornada pelo banco.",
    );
  }
  const names = await loadNames(client, [row]);

  logInfo("action_plans.deadline_change.requested", {
    actorUserId: caller.userId,
    actionPlanId: payload.planId,
    recommendationId: payload.recommendationId,
    target: payload.target,
    requestedDate,
  });
  return mapRow(row, names);
}

export async function decideActionPlanDeadlineChange(
  client: SupabaseClient,
  rawPayload: unknown,
  actorUserId: string,
): Promise<ActionPlanDeadlineChangeRequest> {
  const payload = parseOrThrow(decideActionPlanDeadlineChangeSchema, rawPayload);
  const { data, error } = await client.rpc("decide_action_plan_deadline_change", {
    p_actor_user_id: actorUserId,
    p_request_id: payload.requestId,
    p_decision: payload.decision,
    p_decision_reason: payload.decisionReason,
  });
  if (error) mapDeadlineChangeError(error);
  const row = normalizeRpcRow(data);
  if (!row) throw new Error("A decisão sobre a alteração do final não foi retornada pelo banco.");
  const names = await loadNames(client, [row]);

  logInfo("action_plans.deadline_change.decided", {
    actorUserId,
    requestId: payload.requestId,
    decision: payload.decision,
    actionPlanId: row.action_plan_id,
  });
  return mapRow(row, names);
}
