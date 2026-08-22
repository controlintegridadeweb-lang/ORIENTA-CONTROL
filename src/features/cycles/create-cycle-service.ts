import { databaseErrorMessage, hasDatabaseErrorCode, isUniqueViolation } from "@/infrastructure/supabase/database-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  DomainConflictError,
  DomainValidationError,
} from "@/infrastructure/api/domain-errors";
import { cycleStateLabelOrFallback } from "@/shared/domain/cycle-labels";
import { logInfo } from "@/infrastructure/observability/logger";

/**
 * Serviço canônico de abertura de diagnósticos.
 *
 * Uma ou várias organizações seguem a mesma operação em lote. A RPC unitária
 * `create_cycle` permanece somente como primitiva transacional usada pelas
 * RPCs de lote; não existe um segundo fluxo de criação na interface ou API.
 */

type CreatedCycle = {
  id: string;
  formVersionId: string;
  organizationId: string;
  periodLabel: string;
  referenceStartYear: number | null;
  referenceEndYear: number | null;
  state: string;
  startsAt: string | null;
  responseDeadlineAt: string | null;
};

const cycleRpcRowSchema = z.object({
  id: z.string().min(1),
  form_version_id: z.string().min(1),
  organization_id: z.string().min(1),
  period_label: z.string(),
  reference_start_year: z.number().int().nullable().optional(),
  reference_end_year: z.number().int().nullable().optional(),
  state: z.string().min(1),
  starts_at: z.string().nullable(),
  response_deadline_at: z.string().nullable(),
});

function mapCycleRow(raw: unknown): CreatedCycle {
  const row = cycleRpcRowSchema.parse(raw);
  return {
    id: row.id,
    formVersionId: row.form_version_id,
    organizationId: row.organization_id,
    periodLabel: row.period_label,
    referenceStartYear: row.reference_start_year ?? null,
    referenceEndYear: row.reference_end_year ?? null,
    state: row.state,
    startsAt: row.starts_at,
    responseDeadlineAt: row.response_deadline_at,
  };
}

/** Mapeia o código de erro cru da RPC para um erro de domínio legível. */
function translateRpcError(error: unknown): Error {
  const message = databaseErrorMessage(error);
  if (hasDatabaseErrorCode(message, "form_has_no_published_version")) {
    return new DomainValidationError([
      {
        path: "formId",
        message:
          "O formulário não tem uma versão publicada. Publique uma versão antes de criar diagnósticos.",
      },
    ]);
  }
  if (hasDatabaseErrorCode(message, "organization_not_assigned")) {
    return new DomainValidationError([
      {
        path: "organizationId",
        message: "A organização não está atribuída a este formulário.",
      },
    ]);
  }
  if (hasDatabaseErrorCode(message, "invalid_period_label")) {
    return new DomainValidationError([
      { path: "periodLabel", message: "Informe o período do diagnóstico." },
    ]);
  }
  if (hasDatabaseErrorCode(message, "cycle_schedule_required")) {
    return new DomainValidationError([
      {
        path: "startsAt",
        message:
          "Informe o início e o prazo de resposta para abrir os diagnósticos.",
      },
    ]);
  }
  if (hasDatabaseErrorCode(message, "deadline_before_start")) {
    return new DomainValidationError([
      {
        path: "responseDeadlineAt",
        message: "O prazo de resposta não pode ser anterior ao início.",
      },
    ]);
  }
  if (hasDatabaseErrorCode(message, "immediate_open_start_in_future")) {
    return new DomainValidationError([
      {
        path: "startsAt",
        message: "Para abrir agora, a data de início não pode estar no futuro.",
      },
    ]);
  }
  if (
    hasDatabaseErrorCode(message, "response_deadline_not_future") ||
    hasDatabaseErrorCode(message, "response_deadline_must_be_future")
  ) {
    return new DomainValidationError([
      {
        path: "responseDeadlineAt",
        message: "O prazo de resposta deve estar no futuro.",
      },
    ]);
  }
  if (hasDatabaseErrorCode(message, "scheduled_open_must_be_future")) {
    return new DomainValidationError([
      {
        path: "startsAt",
        message: "Para agendar, informe uma abertura futura.",
      },
    ]);
  }
  if (hasDatabaseErrorCode(message, "validation_deadline_must_follow_response_deadline")) {
    return new DomainValidationError([
      {
        path: "validationDeadlineAt",
        message: "A validação programada deve ocorrer após o prazo de resposta.",
      },
    ]);
  }
  if (hasDatabaseErrorCode(message, "cycle_close_must_follow_validation_deadline")) {
    return new DomainValidationError([
      {
        path: "cycleCloseAt",
        message: "O encerramento programado deve ocorrer após a validação.",
      },
    ]);
  }
  if (hasDatabaseErrorCode(message, "draft_cannot_have_schedule")) {
    return new DomainValidationError([
      {
        path: "mode",
        message: "Rascunhos não podem receber cronograma automático.",
      },
    ]);
  }
  if (hasDatabaseErrorCode(message, "invalid_reminder_offsets")) {
    return new DomainValidationError([
      {
        path: "reminderOffsetsDays",
        message: "Os lembretes informados são inválidos.",
      },
    ]);
  }
  if (
    hasDatabaseErrorCode(message, "cycles_form_period_unique") ||
    hasDatabaseErrorCode(message, "cycles_identity_unique") ||
    isUniqueViolation(error)
  ) {
    return new DomainConflictError(
      "Já existe um diagnóstico deste formulário para esta organização e período.",
    );
  }
  return new Error(message);
}

export type CreateCyclesBatchInput = {
  formId: string;
  organizationIds: string[];
  periodLabel: string;
  referenceStartYear: number;
  referenceEndYear: number;
  startsAt?: string | null;
  responseDeadlineAt?: string | null;
  actorUserId: string;
};

export type OpenCyclesBatchInput = Omit<
  CreateCyclesBatchInput,
  "startsAt" | "responseDeadlineAt"
> & {
  startsAt: string;
  responseDeadlineAt: string;
};

export type CycleBatchMode = "draft" | "open" | "schedule";

export type ProcessCyclesBatchInput = CreateCyclesBatchInput & {
  mode: CycleBatchMode;
  reminderOffsetsDays: number[];
  validationDeadlineAt?: string | null;
  cycleCloseAt?: string | null;
};

export type CycleSchedulesResult = {
  jobsCreated: number;
  remindersScheduled: number;
};

export type ProcessCyclesBatchResult = CreateCyclesBatchResult & {
  schedules: CycleSchedulesResult;
};

type OpenedCycle = CreatedCycle & {
  source: "created" | "existing_draft";
};

type CycleBatchSkipped = {
  organizationId: string;
  cycleId?: string;
  state?: string;
  reason: string;
};

/**
 * Relatório único do lote. `created` é usado na criação em rascunho e `opened`
 * na criação/abertura imediata. Falhas permanecem isoladas por organização.
 */
export type CreateCyclesBatchResult = {
  created: CreatedCycle[];
  updatedDrafts: CreatedCycle[];
  opened: OpenedCycle[];
  skipped: CycleBatchSkipped[];
  failed: { organizationId: string; message: string }[];
};

const batchFailureSchema = z.object({
  status: z.literal("failed"),
  organization_id: z.string().min(1),
  message: z.string().min(1),
});

const createBatchItemSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("created"), cycle: cycleRpcRowSchema }),
  z.object({ status: z.literal("existing_draft"), cycle: cycleRpcRowSchema }),
  z.object({
    status: z.literal("already_exists"),
    organization_id: z.string().min(1),
    cycle: cycleRpcRowSchema.nullable().optional(),
    message: z.string().min(1),
  }),
  batchFailureSchema,
]);

const openBatchItemSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("created_and_opened"),
    cycle: cycleRpcRowSchema,
  }),
  z.object({ status: z.literal("opened_existing"), cycle: cycleRpcRowSchema }),
  z.object({ status: z.literal("already_open"), cycle: cycleRpcRowSchema }),
  z.object({ status: z.literal("not_openable"), cycle: cycleRpcRowSchema }),
  batchFailureSchema,
]);

const processBatchEnvelopeSchema = z.object({
  result: z.array(z.unknown()),
  schedules: z.object({
    jobsCreated: z.number().int().nonnegative(),
    remindersScheduled: z.number().int().nonnegative(),
  }),
});

type OrganizationBatchOutcome =
  | { kind: "created"; cycle: CreatedCycle }
  | { kind: "updated_draft"; cycle: CreatedCycle }
  | { kind: "opened"; cycle: OpenedCycle }
  | { kind: "skipped"; item: CycleBatchSkipped }
  | { kind: "failed"; item: { organizationId: string; message: string } };

function collectBatchOutcomes(
  outcomes: OrganizationBatchOutcome[],
): CreateCyclesBatchResult {
  const result: CreateCyclesBatchResult = {
    created: [],
    updatedDrafts: [],
    opened: [],
    skipped: [],
    failed: [],
  };

  for (const outcome of outcomes) {
    if (outcome.kind === "created") result.created.push(outcome.cycle);
    if (outcome.kind === "updated_draft") result.updatedDrafts.push(outcome.cycle);
    if (outcome.kind === "opened") result.opened.push(outcome.cycle);
    if (outcome.kind === "skipped") result.skipped.push(outcome.item);
    if (outcome.kind === "failed") result.failed.push(outcome.item);
  }

  return result;
}

function failureFromMessage(
  organizationId: string,
  message: string,
): OrganizationBatchOutcome {
  const error = translateRpcError(message);
  const translated =
    error instanceof DomainValidationError
      ? (error.issues[0]?.message ?? error.message)
      : error.message;
  return {
    kind: "failed",
    item: { organizationId, message: translated },
  };
}

function parseCreatedBatch(raw: unknown): CreateCyclesBatchResult {
  const outcomes = z
    .array(createBatchItemSchema)
    .parse(raw ?? [])
    .map((item) => {
      if (item.status === "created") {
        return {
          kind: "created",
          cycle: mapCycleRow(item.cycle),
        } satisfies OrganizationBatchOutcome;
      }
      if (item.status === "existing_draft") {
        return {
          kind: "updated_draft",
          cycle: mapCycleRow(item.cycle),
        } satisfies OrganizationBatchOutcome;
      }
      if (item.status === "already_exists") {
        const cycle = item.cycle ? mapCycleRow(item.cycle) : null;
        return {
          kind: "skipped",
          item: {
            organizationId: item.organization_id,
            cycleId: cycle?.id,
            state: cycle?.state,
            reason: translateRpcError(item.message).message,
          },
        } satisfies OrganizationBatchOutcome;
      }
      return failureFromMessage(item.organization_id, item.message);
    });

  return collectBatchOutcomes(outcomes);
}

function parseOpenedBatch(raw: unknown): CreateCyclesBatchResult {
  const outcomes = z
    .array(openBatchItemSchema)
    .parse(raw ?? [])
    .map((item) => {
      if (item.status === "failed") {
        return failureFromMessage(item.organization_id, item.message);
      }

      const cycle = mapCycleRow(item.cycle);
      if (item.status === "created_and_opened") {
        return {
          kind: "opened",
          cycle: { ...cycle, source: "created" },
        } satisfies OrganizationBatchOutcome;
      }
      if (item.status === "opened_existing") {
        return {
          kind: "opened",
          cycle: { ...cycle, source: "existing_draft" },
        } satisfies OrganizationBatchOutcome;
      }
      if (item.status === "already_open") {
        return {
          kind: "skipped",
          item: {
            organizationId: cycle.organizationId,
            cycleId: cycle.id,
            state: cycle.state,
            reason:
              "O diagnóstico já estava aberto; o cronograma existente foi preservado.",
          },
        } satisfies OrganizationBatchOutcome;
      }
      return {
        kind: "skipped",
        item: {
          organizationId: cycle.organizationId,
          cycleId: cycle.id,
          state: cycle.state,
          reason: `O diagnóstico já está em ${cycleStateLabelOrFallback(cycle.state)} e não pode ser aberto novamente por este lote.`,
        },
      } satisfies OrganizationBatchOutcome;
    });

  return collectBatchOutcomes(outcomes);
}

function assertBatchInput(input: CreateCyclesBatchInput): string[] {
  if (!input.periodLabel || input.periodLabel.trim() === "") {
    throw new DomainValidationError([
      { path: "periodLabel", message: "Informe o período do diagnóstico." },
    ]);
  }
  const invalidReferencePeriod =
    !Number.isInteger(input.referenceStartYear) ||
    input.referenceStartYear < 1900 ||
    input.referenceStartYear > 2199 ||
    !Number.isInteger(input.referenceEndYear) ||
    input.referenceEndYear < input.referenceStartYear ||
    input.referenceEndYear > 2199;
  if (invalidReferencePeriod) {
    throw new DomainValidationError([
      { path: "referencePeriod", message: "Informe um período de referência válido." },
    ]);
  }
  const organizationIds = [...new Set(input.organizationIds)];
  if (organizationIds.length === 0) {
    throw new DomainValidationError([
      {
        path: "organizationIds",
        message: "Selecione ao menos uma organização.",
      },
    ]);
  }
  return organizationIds;
}

/**
 * Processa criação, abertura ou agendamento em uma única transação no banco.
 * A criação dos ciclos, o período de referência e os jobs do cronograma são
 * confirmados ou revertidos em conjunto.
 */
export async function processCyclesForOrganizations(
  supabase: SupabaseClient,
  input: ProcessCyclesBatchInput,
): Promise<ProcessCyclesBatchResult> {
  const organizationIds = assertBatchInput(input);
  const isDraft = input.mode === "draft";

  if (isDraft && (input.startsAt || input.responseDeadlineAt)) {
    throw new DomainValidationError([
      {
        path: "mode",
        message: "Rascunhos não podem receber datas de abertura ou prazo.",
      },
    ]);
  }
  if (!isDraft && (!input.startsAt || !input.responseDeadlineAt)) {
    throw new DomainValidationError([
      {
        path: "startsAt",
        message: "Informe o início e o prazo de resposta dos diagnósticos.",
      },
    ]);
  }

  const { data, error } = await supabase.rpc("process_cycles_batch_with_reference", {
    p_mode: input.mode,
    p_form_id: input.formId,
    p_organization_ids: organizationIds,
    p_period_label: input.periodLabel.trim(),
    p_reference_start_year: input.referenceStartYear,
    p_reference_end_year: input.referenceEndYear,
    p_actor_user_id: input.actorUserId,
    p_starts_at: input.startsAt ?? null,
    p_response_deadline_at: input.responseDeadlineAt ?? null,
    p_reminder_offsets_days: input.reminderOffsetsDays,
    p_validation_deadline_at: input.validationDeadlineAt ?? null,
    p_cycle_close_at: input.cycleCloseAt ?? null,
  });
  if (error) {
    throw translateRpcError(error);
  }

  const envelope = processBatchEnvelopeSchema.parse(data);
  const result =
    input.mode === "open"
      ? parseOpenedBatch(envelope.result)
      : parseCreatedBatch(envelope.result);

  logInfo("cycle.batch_processed", {
    mode: input.mode,
    formId: input.formId,
    periodLabel: input.periodLabel,
    actorUserId: input.actorUserId,
    selectedCount: organizationIds.length,
    createdCount: result.created.length,
    openedCount: result.opened.length,
    skippedCount: result.skipped.length,
    failedCount: result.failed.length,
    jobsCreated: envelope.schedules.jobsCreated,
  });

  return { ...result, schedules: envelope.schedules };
}

/**
 * Compatibilidade para chamadas que criam rascunhos ou programam a abertura.
 * O caminho continua usando a fronteira transacional única.
 */
export async function createCyclesForOrganizations(
  supabase: SupabaseClient,
  input: CreateCyclesBatchInput,
): Promise<CreateCyclesBatchResult> {
  const hasSchedule = Boolean(input.startsAt || input.responseDeadlineAt);
  if (hasSchedule && (!input.startsAt || !input.responseDeadlineAt)) {
    throw new DomainValidationError([
      {
        path: "responseDeadlineAt",
        message: "Informe o início e o prazo de resposta para agendar.",
      },
    ]);
  }

  const processed = await processCyclesForOrganizations(supabase, {
    ...input,
    mode: hasSchedule ? "schedule" : "draft",
    reminderOffsetsDays: [],
    validationDeadlineAt: null,
    cycleCloseAt: null,
  });
  return {
    created: processed.created,
    updatedDrafts: processed.updatedDrafts,
    opened: processed.opened,
    skipped: processed.skipped,
    failed: processed.failed,
  };
}

/**
 * Compatibilidade para abertura imediata, também pela fronteira atômica.
 */
export async function createAndOpenCyclesForOrganizations(
  supabase: SupabaseClient,
  input: OpenCyclesBatchInput,
): Promise<CreateCyclesBatchResult> {
  const processed = await processCyclesForOrganizations(supabase, {
    ...input,
    mode: "open",
    reminderOffsetsDays: [],
    validationDeadlineAt: null,
    cycleCloseAt: null,
  });
  return {
    created: processed.created,
    updatedDrafts: processed.updatedDrafts,
    opened: processed.opened,
    skipped: processed.skipped,
    failed: processed.failed,
  };
}
