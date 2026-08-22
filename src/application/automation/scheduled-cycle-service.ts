import "server-only";

import { randomUUID } from "node:crypto";
import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";
import type { Json } from "@/infrastructure/supabase/database.types";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import {
  runLifecycleBatch,
  type LifecycleBatchAction,
} from "@/application/automation/batch-lifecycle-service";
import { mapConcurrent } from "@/shared/async/map-concurrent";

const SCHEDULED_JOB_KINDS = [
  "cycle_open",
  "validation_finalize",
  "cycle_close",
  "reminder_dispatch",
] as const;

type ScheduledJobKind = (typeof SCHEDULED_JOB_KINDS)[number];

function isScheduledJobKind(value: string): value is ScheduledJobKind {
  return SCHEDULED_JOB_KINDS.some((kind) => kind === value);
}

type JobPayload = { [key: string]: Json | undefined };

type JobRow = {
  id: string;
  kind: ScheduledJobKind;
  requested_by: string | null;
  attempts: number;
  max_attempts: number;
  payload: JobPayload;
};

type QueryResult = PromiseLike<{ error: { message?: string } | null }>;

async function assertWrite(query: QueryResult): Promise<void> {
  const { error } = await query;
  if (error) throw error;
}

function jobPayload(value: Json): JobPayload {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export type CycleScheduleInput = {
  cycleIds: string[];
  actorUserId: string;
  reminderOffsetsDays?: number[];
  validationDeadlineAt?: string | null;
  cycleCloseAt?: string | null;
};

export type CycleScheduleResult = {
  jobsCreated: number;
  remindersScheduled: number;
};

function uniqueCycleIds(cycleIds: string[]): string[] {
  return Array.from(new Set(cycleIds)).sort();
}

async function prepareScheduleRevisions(
  client: TypedSupabaseClient,
  input: CycleScheduleInput,
  cycleIds: string[],
): Promise<{ revisions: Map<string, number>; jobsCreated: number; remindersScheduled: number }> {
  const reminderOffsets = Array.from(
    new Set(
      (input.reminderOffsetsDays ?? []).filter(
        (value) => Number.isInteger(value) && value >= 0,
      ),
    ),
  ).sort((a, b) => b - a);

  // O SQL aceita timestamptz nulo; o gerador de tipos marca os args como string obrigatória.
  const { data, error } = await client.rpc(
    "prepare_cycle_schedule_registration",
    {
      p_cycle_ids: cycleIds,
      p_reminder_offsets_days: reminderOffsets,
      p_validation_deadline_at: input.validationDeadlineAt ?? null,
      p_cycle_close_at: input.cycleCloseAt ?? null,
      p_actor_user_id: input.actorUserId,
    },
  );
  if (error) throw error;

  const revisions = new Map<string, number>();
  let jobsCreated = 0;
  let remindersScheduled = 0;
  for (const row of data ?? []) {
    revisions.set(String(row.cycle_id), Number(row.schedule_revision));
    jobsCreated += Number(row.jobs_created ?? 0);
    remindersScheduled += Number(row.reminders_created ?? 0);
  }
  if (revisions.size !== cycleIds.length) {
    throw new Error("Nem todos os diagnósticos puderam preparar a programação.");
  }
  return { revisions, jobsCreated, remindersScheduled };
}

export async function registerCycleSchedules(
  input: CycleScheduleInput,
): Promise<CycleScheduleResult> {
  const cycleIds = uniqueCycleIds(input.cycleIds);
  if (cycleIds.length === 0) return { jobsCreated: 0, remindersScheduled: 0 };

  const client = createSupabaseServiceRoleClient();
  const { jobsCreated, remindersScheduled } = await prepareScheduleRevisions(
    client,
    input,
    cycleIds,
  );
  return { jobsCreated, remindersScheduled };
}

function scheduleRevisionFromJson(value: Json): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const revision = value.schedule_revision;
  return typeof revision === "number" && Number.isInteger(revision) && revision >= 0
    ? revision
    : null;
}

async function cycleRevisionsForJob(
  client: TypedSupabaseClient,
  jobId: string,
): Promise<Map<string, number>> {
  const { data, error } = await client
    .from("automation_job_items")
    .select("entity_id,input")
    .eq("job_id", jobId)
    .eq("entity_type", "cycle")
    .eq("status", "pending");
  if (error) throw error;

  const items = data ?? [];
  const ids = items.map((row) => String(row.entity_id));
  if (ids.length === 0) return new Map();

  const { data: cycles, error: cyclesError } = await client
    .from("cycles")
    .select("id,schedule_revision")
    .in("id", ids);
  if (cyclesError) throw cyclesError;
  const currentRevision = new Map(
    (cycles ?? []).map((cycle) => [String(cycle.id), Number(cycle.schedule_revision)] as const),
  );

  const valid = new Map<string, number>();
  for (const item of items) {
    const cycleId = String(item.entity_id);
    const current = currentRevision.get(cycleId);
    const expected = scheduleRevisionFromJson(item.input);
    if (current == null) {
      const { error: missingError } = await client
        .from("automation_job_items")
        .update({ status: "failed", message: "Diagnóstico não encontrado." })
        .eq("job_id", jobId)
        .eq("entity_type", "cycle")
        .eq("entity_id", cycleId)
        .eq("status", "pending");
      if (missingError) throw missingError;
      continue;
    }

    const isLegacyRevision = expected == null && current === 0;
    if (expected === current || isLegacyRevision) {
      valid.set(cycleId, expected ?? 0);
      continue;
    }

    const { error: staleError } = await client
      .from("automation_job_items")
      .update({
        status: "skipped",
        message: `Programação obsoleta: revisão ${expected ?? 0}; revisão atual ${current}.`,
      })
      .eq("job_id", jobId)
      .eq("entity_type", "cycle")
      .eq("entity_id", cycleId)
      .eq("status", "pending");
    if (staleError) throw staleError;
  }

  return valid;
}

function targetReached(action: LifecycleBatchAction, state: string | null): boolean {
  if (!state) return false;
  if (action === "open_cycle") return state !== "draft";
  if (action === "finalize_validation") return state === "validated" || state === "completed";
  return state === "completed";
}

async function rescheduleUnresolved(
  client: TypedSupabaseClient,
  job: JobRow,
  cycleIds: string[],
  startedAtMs: number,
) {
  if (cycleIds.length === 0) return;
  const waitsForBusinessCondition =
    job.kind === "validation_finalize" || job.kind === "cycle_close";
  const exhausted = !waitsForBusinessCondition && job.attempts >= job.max_attempts;
  if (exhausted) {
    const message = `A operação atingiu o limite de ${job.max_attempts} tentativas com diagnósticos ainda não aptos.`;
    await assertWrite(
      client
        .from("automation_job_items")
        .update({ status: "failed", message })
        .eq("job_id", job.id)
        .eq("entity_type", "cycle")
        .in("entity_id", cycleIds),
    );
    await assertWrite(
      client
        .from("automation_jobs")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
          locked_at: null,
          locked_by: null,
          last_duration_ms: Date.now() - startedAtMs,
        })
        .eq("id", job.id),
    );
    return;
  }

  await assertWrite(
    client
      .from("automation_job_items")
      .update({ status: "pending", message: null })
      .eq("job_id", job.id)
      .eq("entity_type", "cycle")
      .in("entity_id", cycleIds),
  );

  await assertWrite(
    client
      .from("automation_jobs")
      .update({
        status: "pending",
        scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        started_at: null,
        completed_at: null,
        error_message: null,
        attempts: waitsForBusinessCondition ? 0 : job.attempts,
        locked_at: null,
        locked_by: null,
        last_duration_ms: Date.now() - startedAtMs,
      })
      .eq("id", job.id),
  );
}

async function retryOrFailJob(
  client: TypedSupabaseClient,
  job: JobRow,
  message: string,
  startedAtMs: number,
): Promise<void> {
  const exhausted = job.attempts >= job.max_attempts;
  const retryDelayMinutes = Math.min(15 * 2 ** Math.max(0, job.attempts - 1), 6 * 60);

  await assertWrite(
    client
      .from("automation_job_items")
      .update({
        status: exhausted ? "failed" : "pending",
        message,
      })
      .eq("job_id", job.id)
      .in("status", ["failed", "processing", "pending"]),
  );

  const commonUpdate = {
    error_message: message,
    locked_at: null,
    locked_by: null,
    last_duration_ms: Date.now() - startedAtMs,
  };
  const jobUpdate = exhausted
    ? {
        ...commonUpdate,
        status: "failed" as const,
        completed_at: new Date().toISOString(),
      }
    : {
        ...commonUpdate,
        status: "pending" as const,
        scheduled_for: new Date(
          Date.now() + retryDelayMinutes * 60_000,
        ).toISOString(),
        completed_at: null,
        started_at: null,
      };

  const { error } = await client
    .from("automation_jobs")
    .update(jobUpdate)
    .eq("id", job.id);
  if (error) throw error;
}

async function dispatchDeadlineReminder(
  client: TypedSupabaseClient,
  job: JobRow,
  cycleRevisions: ReadonlyMap<string, number>,
): Promise<{ succeeded: number; skipped: number; failed: number }> {
  const offsetDays = Number(job.payload?.offset_days ?? 0);
  const outcomes = await mapConcurrent(
    Array.from(cycleRevisions.entries()),
    4,
    async ([cycleId, expectedRevision]) => {
      const { data, error } = await client.rpc("dispatch_cycle_deadline_reminder", {
        p_job_id: job.id,
        p_cycle_id: cycleId,
        p_expected_schedule_revision: expectedRevision,
        p_offset_days: offsetDays,
      });
      if (error) throw error;
      const status =
        data && typeof data === "object" && !Array.isArray(data)
          ? data.status
          : null;
      return status === "succeeded" || status === "failed" ? status : "skipped";
    },
  );

  return {
    succeeded: outcomes.filter((status) => status === "succeeded").length,
    skipped: outcomes.filter((status) => status === "skipped").length,
    failed: outcomes.filter((status) => status === "failed").length,
  };
}

export async function processDueCycleAutomations() {
  const client = createSupabaseServiceRoleClient();
  const workerId = `cycle-jobs:${randomUUID()}`;
  const { data: jobs, error } = await client.rpc("claim_automation_jobs", {
    p_worker_id: workerId,
    p_kinds: [...SCHEDULED_JOB_KINDS],
    p_limit: 10,
    p_lock_timeout: "15 minutes",
  });
  if (error) throw error;

  return mapConcurrent(jobs ?? [], 2, async (row) => {
    const startedAtMs = Date.now();
    if (!isScheduledJobKind(row.kind)) {
      return {
        jobId: String(row.id),
        action: String(row.kind),
        status: "failed" as const,
        message: "Tipo de job programado desconhecido.",
      };
    }

    const job: JobRow = {
      id: String(row.id),
      kind: row.kind,
      requested_by: row.requested_by ? String(row.requested_by) : null,
      attempts: Number(row.attempts),
      max_attempts: Number(row.max_attempts),
      payload: jobPayload(row.payload),
    };
    const actorUserId = job.requested_by ?? "";
    if (!actorUserId) {
      const message = "O job não possui um administrador responsável válido.";
      await retryOrFailJob(client, job, message, startedAtMs);
      return { jobId: job.id, action: job.kind, status: "failed" as const, message };
    }

    try {
      const cycleRevisions = await cycleRevisionsForJob(client, job.id);
      const cycleIds = Array.from(cycleRevisions.keys());
      if (cycleIds.length === 0) {
        const { count: failedItemCount, error: failedCountError } = await client
          .from("automation_job_items")
          .select("id", { count: "exact", head: true })
          .eq("job_id", job.id)
          .eq("status", "failed");
        if (failedCountError) throw failedCountError;
        const hasFailures = (failedItemCount ?? 0) > 0;
        const { error: completionError } = await client
          .from("automation_jobs")
          .update({
            status: hasFailures ? "completed_with_errors" : "completed",
            completed_at: new Date().toISOString(),
            result_summary: { failed: failedItemCount ?? 0 },
            locked_at: null,
            locked_by: null,
            last_duration_ms: Date.now() - startedAtMs,
          })
          .eq("id", job.id);
        if (completionError) throw completionError;
        return {
          jobId: job.id,
          action: job.kind,
          status: hasFailures ? ("partial" as const) : ("succeeded" as const),
        };
      }

      if (job.kind === "reminder_dispatch") {
        const reminder = await dispatchDeadlineReminder(client, job, cycleRevisions);
        const { error: completionError } = await client
          .from("automation_jobs")
          .update({
            status: reminder.failed > 0 ? "completed_with_errors" : "completed",
            completed_at: new Date().toISOString(),
            result_summary: reminder,
            locked_at: null,
            locked_by: null,
            last_duration_ms: Date.now() - startedAtMs,
          })
          .eq("id", job.id);
        if (completionError) throw completionError;
        return {
          jobId: job.id,
          action: job.kind,
          status:
            reminder.failed > 0 || reminder.skipped > 0
              ? ("partial" as const)
              : ("succeeded" as const),
        };
      }

      const action: LifecycleBatchAction =
        job.kind === "cycle_open"
          ? "open_cycle"
          : job.kind === "validation_finalize"
            ? "finalize_validation"
            : "close_cycle";
      const lifecycle = await runLifecycleBatch({
        action,
        cycleIds,
        actorUserId,
        executedBySystem: true,
        jobId: job.id,
        expectedScheduleRevisions: Object.fromEntries(cycleRevisions),
      });
      if (lifecycle.failed.length > 0) {
        const details = lifecycle.failed
          .slice(0, 3)
          .map((item) => `${item.cycleId}: ${item.message}`)
          .join(" | ");
        throw new Error(`Falha em ${lifecycle.failed.length} diagnóstico(s): ${details}`);
      }

      const unresolved = lifecycle.skipped
        .filter(
          (item) =>
            !targetReached(action, item.toState) &&
            !item.message.startsWith("Programação obsoleta:"),
        )
        .map((item) => item.cycleId);
      await rescheduleUnresolved(client, job, unresolved, startedAtMs);
      return {
        jobId: job.id,
        action: job.kind,
        status: unresolved.length > 0 ? ("partial" as const) : ("succeeded" as const),
      };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Falha não identificada.";
      await retryOrFailJob(client, job, message, startedAtMs);
      return { jobId: job.id, action: job.kind, status: "failed" as const, message };
    }
  });
}
