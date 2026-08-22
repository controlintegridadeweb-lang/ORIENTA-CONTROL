import "server-only";

import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { CycleStateService, type CycleRow } from "@/features/cycles/cycle-state-service";
import { recordAudit } from "@/infrastructure/audit/record-audit";
import { mapConcurrent } from "@/shared/async/map-concurrent";
import { CycleClosureService } from "@/application/reporting/cycle-closure-service";

export const lifecycleBatchActionSchema = z.enum([
  "open_cycle",
  "finalize_validation",
  "close_cycle",
]);
export type LifecycleBatchAction = z.infer<typeof lifecycleBatchActionSchema>;

type LifecycleBatchItemResult = {
  cycleId: string;
  status: "succeeded" | "skipped" | "failed";
  fromState: string | null;
  toState: string | null;
  message: string;
};

export type LifecycleBatchResult = {
  jobId: string;
  action: LifecycleBatchAction;
  total: number;
  succeeded: LifecycleBatchItemResult[];
  skipped: LifecycleBatchItemResult[];
  failed: LifecycleBatchItemResult[];
};

const MAX_BATCH_SIZE = 500;
const CONCURRENCY = 4;

type QueryResult = PromiseLike<{ error: { message?: string } | null }>;

async function assertWrite(query: QueryResult): Promise<void> {
  const { error } = await query;
  if (error) throw error;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Falha não identificada durante a operação.";
}

function skip(cycle: CycleRow, message: string): LifecycleBatchItemResult {
  return {
    cycleId: cycle.id,
    status: "skipped",
    fromState: cycle.state,
    toState: cycle.state,
    message,
  };
}

async function executeCycleAction(
  service: CycleStateService,
  closureService: CycleClosureService,
  cycle: CycleRow,
  action: LifecycleBatchAction,
  actorUserId: string,
  expectedScheduleRevision?: number,
): Promise<LifecycleBatchItemResult> {
  try {
    if (expectedScheduleRevision != null) {
      const outcome = await service.executeScheduledAction({
        cycleId: cycle.id,
        actorUserId,
        action,
        expectedScheduleRevision,
      });
      if (action === "close_cycle" && outcome.status !== "failed") {
        const current = await service.require(cycle.id);
        if (current.state === "completed") {
          const report = await closureService.ensureClosedCycleReport(
            cycle.id,
            actorUserId,
          );
          if (report.status === "emission_failed") {
            return {
              cycleId: cycle.id,
              status: "failed",
              fromState: outcome.fromState,
              toState: current.state,
              message: report.message ?? "A avaliação foi encerrada, mas a emissão do relatório falhou.",
            };
          }
        }
      }
      return {
        cycleId: cycle.id,
        status: outcome.status,
        fromState: outcome.fromState,
        toState: outcome.toState,
        message:
          action === "close_cycle" && outcome.status === "succeeded"
            ? "Avaliação encerrada e relatório oficial emitido."
            : outcome.message,
      };
    }

    if (action === "open_cycle") {
      if (cycle.state !== "draft") {
        return skip(cycle, "O diagnóstico já saiu do rascunho e não precisa de nova abertura.");
      }
      const updated = await service.transition(cycle, "in_response", actorUserId);
      return {
        cycleId: cycle.id,
        status: "succeeded",
        fromState: cycle.state,
        toState: updated.state,
        message: "Diagnóstico aberto para resposta.",
      };
    }

    if (action === "finalize_validation") {
      if (cycle.state === "validated" || cycle.state === "completed") {
        return skip(cycle, "A validação deste diagnóstico já foi concluída.");
      }
      if (cycle.state !== "in_validation") {
        return skip(cycle, "O diagnóstico ainda não está pronto para concluir a validação.");
      }
      const updated = await service.consolidateValidation(cycle, actorUserId);
      return {
        cycleId: cycle.id,
        status: "succeeded",
        fromState: cycle.state,
        toState: updated.state,
        message: "Validação concluída e FAMI calculado.",
      };
    }

    if (cycle.state === "completed") {
      const report = await closureService.ensureClosedCycleReport(cycle.id, actorUserId);
      if (report.status === "emission_failed") {
        return {
          cycleId: cycle.id,
          status: "failed",
          fromState: cycle.state,
          toState: cycle.state,
          message: report.message ?? "A emissão do relatório oficial ainda está pendente.",
        };
      }
      return skip(cycle, "A avaliação já estava encerrada e o relatório oficial está preservado.");
    }
    if (cycle.state !== "validated") {
      return skip(cycle, "O ciclo precisa ter o diagnóstico validado antes do encerramento.");
    }
    const closure = await closureService.closeAndEmit(cycle, actorUserId);
    if (closure.report.status === "emission_failed") {
      return {
        cycleId: cycle.id,
        status: "failed",
        fromState: cycle.state,
        toState: closure.cycle.state,
        message: closure.report.message ?? "A avaliação foi encerrada, mas a emissão do relatório falhou.",
      };
    }
    return {
      cycleId: cycle.id,
      status: "succeeded",
      fromState: cycle.state,
      toState: closure.cycle.state,
      message: "Avaliação encerrada e relatório oficial emitido.",
    };
  } catch (error) {
    return {
      cycleId: cycle.id,
      status: "failed",
      fromState: cycle.state,
      toState: null,
      message: errorMessage(error),
    };
  }
}

export async function runLifecycleBatch(input: {
  action: LifecycleBatchAction;
  cycleIds: string[];
  actorUserId: string;
  executedBySystem?: boolean;
  jobId?: string;
  expectedScheduleRevisions?: Readonly<Record<string, number>>;
}): Promise<LifecycleBatchResult> {
  const cycleIds = Array.from(new Set(input.cycleIds));
  if (cycleIds.length === 0) throw new Error("Selecione ao menos um diagnóstico.");
  if (cycleIds.length > MAX_BATCH_SIZE) {
    throw new Error(`O lote aceita no máximo ${MAX_BATCH_SIZE} diagnósticos por execução.`);
  }

  const startedAtMs = Date.now();
  const client = createSupabaseServiceRoleClient();
  const service = new CycleStateService(client);
  const closureService = new CycleClosureService(client);

  let jobId = input.jobId ?? null;
  if (jobId) {
    const { error } = await client.from("automation_jobs").update({
      status: "processing",
      requested_by: input.actorUserId,
      executed_by_system: input.executedBySystem ?? false,
      started_at: new Date().toISOString(),
      completed_at: null,
      payload: { cycle_ids: cycleIds },
      error_message: null,
    }).eq("id", jobId);
    if (error) throw error;
  } else {
    const { data: job, error: jobError } = await client
      .from("automation_jobs")
      .insert({
        kind:
          input.action === "open_cycle"
            ? "cycle_open"
            : input.action === "finalize_validation"
              ? "validation_finalize"
              : "cycle_close",
        status: "processing",
        requested_by: input.actorUserId,
        executed_by_system: input.executedBySystem ?? false,
        started_at: new Date().toISOString(),
        payload: { cycle_ids: cycleIds },
      })
      .select("id")
      .single();
    if (jobError || !job) throw jobError ?? new Error("Não foi possível registrar o lote.");
    jobId = String(job.id);
  }

  const { error: itemsError } = await client.from("automation_job_items").upsert(
    cycleIds.map((cycleId) => ({
      job_id: jobId,
      entity_type: "cycle",
      entity_id: cycleId,
      status: "pending",
      message: null,
      output: {},
    })),
    { onConflict: "job_id,entity_type,entity_id" },
  );
  if (itemsError) throw itemsError;
  if (!jobId) throw new Error("Não foi possível identificar o lote registrado.");
  const resolvedJobId = jobId;

  const cycles = await service.findMany(cycleIds);
  const foundIds = new Set(cycles.map((cycle) => cycle.id));
  const missing: LifecycleBatchItemResult[] = cycleIds
    .filter((cycleId) => !foundIds.has(cycleId))
    .map((cycleId) => ({
      cycleId,
      status: "failed",
      fromState: null,
      toState: null,
      message: "Diagnóstico não encontrado.",
    }));

  const processed = await mapConcurrent(cycles, CONCURRENCY, async (cycle) => {
    await assertWrite(
      client
        .from("automation_job_items")
        .update({ status: "processing" })
        .eq("job_id", resolvedJobId)
        .eq("entity_type", "cycle")
        .eq("entity_id", cycle.id),
    );

    const result = await executeCycleAction(
      service,
      closureService,
      cycle,
      input.action,
      input.actorUserId,
      input.expectedScheduleRevisions?.[cycle.id],
    );
    await assertWrite(
      client
        .from("automation_job_items")
        .update({
          status: result.status,
          message: result.message,
          output: { from_state: result.fromState, to_state: result.toState },
        })
        .eq("job_id", resolvedJobId)
        .eq("entity_type", "cycle")
        .eq("entity_id", cycle.id),
    );
    return result;
  });

  for (const item of missing) {
    await assertWrite(
      client
        .from("automation_job_items")
        .update({ status: "failed", message: item.message })
        .eq("job_id", resolvedJobId)
        .eq("entity_type", "cycle")
        .eq("entity_id", item.cycleId),
    );
  }

  const all = [...processed, ...missing];
  const succeeded = all.filter((item) => item.status === "succeeded");
  const skipped = all.filter((item) => item.status === "skipped");
  const failed = all.filter((item) => item.status === "failed");
  const finalStatus =
    failed.length === 0
      ? "completed"
      : succeeded.length > 0 || skipped.length > 0
        ? "completed_with_errors"
        : "failed";

  await assertWrite(
    client
      .from("automation_jobs")
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        result_summary: {
          total: all.length,
          succeeded: succeeded.length,
          skipped: skipped.length,
          failed: failed.length,
        },
        error_message:
          failed.length === all.length
            ? "Nenhum diagnóstico pôde ser processado."
            : null,
        locked_at: null,
        locked_by: null,
        last_duration_ms: Date.now() - startedAtMs,
      })
      .eq("id", resolvedJobId),
  );

  await recordAudit(client, {
    actorUserId: input.actorUserId,
    eventType: `automation.${input.action}`,
    entityType: "automation_jobs",
    recordId: resolvedJobId,
    after: {
      total: all.length,
      succeeded: succeeded.length,
      skipped: skipped.length,
      failed: failed.length,
      executed_by_system: input.executedBySystem ?? false,
    },
  });

  return { jobId: resolvedJobId, action: input.action, total: all.length, succeeded, skipped, failed };
}
