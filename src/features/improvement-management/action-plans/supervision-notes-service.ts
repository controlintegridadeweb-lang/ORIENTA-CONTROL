import { z } from "zod";
import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import { logInfo } from "@/infrastructure/observability/logger";
import { displayNameFromProfile } from "@/infrastructure/auth/profile-types";
import {
  createSupervisionNoteSchema,
  decideSupervisionRequestSchema,
  listSupervisionNotesQuerySchema,
  respondSupervisionRequestSchema,
} from "./schemas";
import {
  ActionPlansNotFoundError,
  ActionPlansValidationError,
  assertRecommendationScope,
  parseOrThrow,
  type Caller,
  type Client,
} from "./access";
import type { PaginatedHistory, SupervisionNoteEntry } from "./types";

const NOTE_SELECT = [
  "id",
  "recommendation_id",
  "action_plan_id",
  "action_revision",
  "action_snapshot",
  "note_type",
  "lifecycle_status",
  "body",
  "response_body",
  "responded_by",
  "responded_at",
  "resolution_body",
  "resolved_by",
  "resolved_at",
  "created_at",
  "author_id",
  "author_role",
].join(", ");

const noteRowSchema = z.object({
  id: z.string(),
  recommendation_id: z.string(),
  action_plan_id: z.string().nullable(),
  action_revision: z.number().nullable(),
  action_snapshot: z.unknown(),
  note_type: z.string(),
  lifecycle_status: z.string(),
  body: z.string(),
  response_body: z.string().nullable(),
  responded_by: z.string().nullable(),
  responded_at: z.string().nullable(),
  resolution_body: z.string().nullable(),
  resolved_by: z.string().nullable(),
  resolved_at: z.string().nullable(),
  created_at: z.string(),
  author_id: z.string(),
  author_role: z.string(),
}).passthrough();

const noteRowsSchema = z.array(noteRowSchema);
type NoteRow = z.infer<typeof noteRowSchema>;

async function loadProfileNames(
  client: Client,
  userIds: string[],
): Promise<Map<string, string>> {
  const nameById = new Map<string, string>();
  if (userIds.length === 0) return nameById;

  const { data: profiles, error } = await client
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", userIds);
  if (error) throw error;

  for (const profile of profiles ?? []) {
    const userId = String(profile.user_id);
    const fullName = (profile.full_name as string | null) ?? null;
    if (!fullName?.trim()) continue;
    nameById.set(userId, displayNameFromProfile(fullName, null));
  }
  return nameById;
}

function snapshotObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function actionLabelFromSnapshot(snapshot: Record<string, unknown>): string | null {
  const text = typeof snapshot.actionText === "string" ? snapshot.actionText.trim() : "";
  if (!text) return null;
  return text.length > 100 ? `${text.slice(0, 100)}…` : text;
}

function toEntry(row: NoteRow, nameById: Map<string, string>): SupervisionNoteEntry {
  const authorId = String(row.author_id);
  const snapshot = snapshotObject(row.action_snapshot);
  return {
    id: String(row.id),
    recommendationId: String(row.recommendation_id),
    actionPlanId: row.action_plan_id ? String(row.action_plan_id) : null,
    actionRevision: row.action_revision == null ? null : Number(row.action_revision),
    actionSnapshot: snapshot,
    actionLabel: actionLabelFromSnapshot(snapshot),
    noteType: String(row.note_type),
    lifecycleStatus: String(row.lifecycle_status),
    body: String(row.body),
    responseBody: row.response_body ? String(row.response_body) : null,
    respondedBy: row.responded_by ? String(row.responded_by) : null,
    respondedByName: row.responded_by
      ? nameById.get(String(row.responded_by)) ?? "Respondente"
      : null,
    respondedAt: row.responded_at ? String(row.responded_at) : null,
    resolutionBody: row.resolution_body ? String(row.resolution_body) : null,
    resolvedBy: row.resolved_by ? String(row.resolved_by) : null,
    resolvedByName: row.resolved_by
      ? nameById.get(String(row.resolved_by)) ?? "Administrador"
      : null,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    createdAt: String(row.created_at),
    authorId,
    authorName: nameById.get(authorId) ?? "Usuário",
    authorRole: String(row.author_role),
  };
}

async function mapRows(client: Client, rows: NoteRow[]): Promise<SupervisionNoteEntry[]> {
  const userIds = Array.from(
    new Set(
      rows
        .flatMap((row) => [row.author_id, row.responded_by, row.resolved_by])
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );
  const nameById = await loadProfileNames(client, userIds);
  return rows.map((row) => toEntry(row, nameById));
}

function supervisionError(error: unknown): never {
  const message = error instanceof Error
    ? error.message
    : String((error as { message?: unknown } | null)?.message ?? "");
  const known: Array<[string, string]> = [
    ["supervision_note_action_required", "Selecione a ação relacionada ao registro."],
    ["supervision_create_not_authorized", "Somente administradores podem registrar pareceres."],
    ["supervision_body_required", "Descreva o registro da supervisão."],
    ["supervision_cycle_not_open", "A supervisão só pode ser alterada enquanto o ciclo estiver em acompanhamento."],
    ["supervision_recommendation_not_found", "A recomendação não existe mais."],
    ["supervision_action_not_found", "A ação selecionada não existe mais."],
    ["supervision_action_recommendation_mismatch", "A ação não pertence a esta recomendação."],
    ["supervision_cancelled_action_not_allowed", "Ações canceladas não podem receber esta decisão."],
    ["supervision_approval_requires_completed_action", "Conclua a ação antes de registrar o aceite da execução."],
    ["supervision_approval_requires_execution_evidence", "Adicione ao menos uma comprovação válida da revisão atual antes de registrar o aceite."],
    ["supervision_approval_has_open_request", "Resolva as solicitações ou pendências abertas antes de registrar o aceite."],
    ["supervision_request_not_open", "A solicitação já foi respondida ou encerrada."],
    ["supervision_request_not_pending", "A solicitação já foi encerrada."],
    ["supervision_resolution_requires_response", "Aguarde o respondente informar o atendimento antes de confirmar a resolução."],
    ["supervision_response_required", "Descreva o ajuste realizado."],
    ["supervision_resolution_required", "Informe a justificativa da decisão."],
  ];
  for (const [code, friendly] of known) {
    if (hasDatabaseErrorCode(message, code)) {
      throw new ActionPlansValidationError([{ path: "_", message: friendly }]);
    }
  }
  if (hasDatabaseErrorCode(message, "supervision_note_not_found")) {
    throw new ActionPlansNotFoundError("Registro de supervisão não encontrado.");
  }
  throw error;
}

async function loadNoteRecommendationId(client: Client, noteId: string): Promise<string> {
  const { data, error } = await client
    .from("action_plan_supervision_notes")
    .select("recommendation_id")
    .eq("id", noteId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.recommendation_id) {
    throw new ActionPlansNotFoundError("Registro de supervisão não encontrado.");
  }
  return String(data.recommendation_id);
}

export async function listSupervisionNotes(
  client: Client,
  rawQuery: unknown,
  caller: Caller,
): Promise<PaginatedHistory<SupervisionNoteEntry>> {
  const query = parseOrThrow(listSupervisionNotesQuerySchema, rawQuery);
  await assertRecommendationScope(client, query.recommendationId, caller);

  let request = client
    .from("action_plan_supervision_notes")
    .select(NOTE_SELECT, { count: "exact" })
    .eq("recommendation_id", query.recommendationId);
  if (query.actionPlanId) {
    request = request.eq("action_plan_id", query.actionPlanId);
  }
  if (query.lifecycleStatuses?.length) {
    request = request.in("lifecycle_status", query.lifecycleStatuses);
  }
  const { data, error, count } = await request
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(query.offset, query.offset + query.limit - 1);
  if (error) throw error;

  const items = await mapRows(client, noteRowsSchema.parse(data ?? []));
  const total = count ?? 0;
  return {
    items,
    total,
    limit: query.limit,
    offset: query.offset,
    hasMore: query.offset + items.length < total,
  };
}

export async function createSupervisionNote(
  client: Client,
  rawPayload: unknown,
  caller: Caller,
  actorUserId: string,
): Promise<SupervisionNoteEntry> {
  if (caller.role !== "admin") {
    throw new ActionPlansValidationError([
      { path: "_", message: "Somente administradores podem registrar pareceres." },
    ]);
  }

  const payload = parseOrThrow(createSupervisionNoteSchema, rawPayload);
  await assertRecommendationScope(client, payload.recommendationId, caller);

  const { data, error } = await client.rpc(
    "create_action_plan_supervision_note",
    {
      p_recommendation_id: payload.recommendationId,
      p_action_plan_id: payload.actionPlanId ?? null,
      p_actor_user_id: actorUserId,
      p_note_type: payload.noteType,
      p_body: payload.body,
    },
  );
  if (error) supervisionError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new ActionPlansNotFoundError("Registro de supervisão não encontrado.");

  logInfo("action_plans.supervision_note.created", {
    recommendationId: payload.recommendationId,
    actionPlanId: payload.actionPlanId ?? null,
    noteType: payload.noteType,
    authorUserId: actorUserId,
  });

  return (await mapRows(client, [row as NoteRow]))[0]!;
}

export async function respondToSupervisionRequest(
  client: Client,
  rawPayload: unknown,
  caller: Caller,
  actorUserId: string,
): Promise<SupervisionNoteEntry> {
  if (caller.role !== "respondent") {
    throw new ActionPlansValidationError([
      { path: "_", message: "Somente respondentes podem informar o ajuste realizado." },
    ]);
  }
  const payload = parseOrThrow(respondSupervisionRequestSchema, rawPayload);
  const recommendationId = await loadNoteRecommendationId(client, payload.noteId);
  await assertRecommendationScope(client, recommendationId, caller);

  const { data, error } = await client.rpc(
    "respond_to_action_plan_supervision_request",
    {
      p_note_id: payload.noteId,
      p_actor_user_id: actorUserId,
      p_response_body: payload.responseBody,
    },
  );
  if (error) supervisionError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new ActionPlansNotFoundError("Registro de supervisão não encontrado.");

  logInfo("action_plans.supervision_request.acknowledged", {
    noteId: payload.noteId,
    actorUserId,
  });
  return (await mapRows(client, [row as NoteRow]))[0]!;
}

export async function decideSupervisionRequest(
  client: Client,
  rawPayload: unknown,
  caller: Caller,
  actorUserId: string,
): Promise<SupervisionNoteEntry> {
  if (caller.role !== "admin") {
    throw new ActionPlansValidationError([
      { path: "_", message: "Somente administradores podem encerrar solicitações." },
    ]);
  }
  const payload = parseOrThrow(decideSupervisionRequestSchema, rawPayload);
  const recommendationId = await loadNoteRecommendationId(client, payload.noteId);
  await assertRecommendationScope(client, recommendationId, caller);

  const { data, error } = await client.rpc(
    "decide_action_plan_supervision_request",
    {
      p_note_id: payload.noteId,
      p_actor_user_id: actorUserId,
      p_decision: payload.decision,
      p_resolution_body: payload.resolutionBody,
    },
  );
  if (error) supervisionError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new ActionPlansNotFoundError("Registro de supervisão não encontrado.");

  logInfo("action_plans.supervision_request.decided", {
    noteId: payload.noteId,
    decision: payload.decision,
    actorUserId,
  });
  return (await mapRows(client, [row as NoteRow]))[0]!;
}
