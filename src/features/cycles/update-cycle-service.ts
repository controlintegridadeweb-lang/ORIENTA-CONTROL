import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DomainConflictError,
  DomainNotFoundError,
  DomainValidationError,
} from "@/infrastructure/api/domain-errors";
import { CycleStateService } from "@/features/cycles/cycle-state-service";
import { logInfo } from "@/infrastructure/observability/logger";

export type UpdateCycleScheduleInput = {
  startsAt?: string | null;
  responseDeadlineAt?: string | null;
  validationDeadlineAt?: string | null;
  cycleCloseAt?: string | null;
  actorUserId: string;
};

export type UpdatedCycleSchedule = {
  id: string;
  startsAt: string | null;
  responseDeadlineAt: string | null;
  validationDeadlineAt: string | null;
  cycleCloseAt: string | null;
};

function parseInstant(value: string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Atualiza início e prazo de um ciclo em rascunho (antes de abrir).
 * Abertura (draft → in_response) continua exigindo ambas as datas definidas.
 */
export async function updateCycleSchedule(
  supabase: SupabaseClient,
  cycleId: string,
  input: UpdateCycleScheduleInput,
): Promise<UpdatedCycleSchedule> {
  const service = new CycleStateService(supabase);
  const cycle = await service.find(cycleId);
  if (!cycle) {
    throw new DomainNotFoundError("Diagnóstico não encontrado.");
  }
  if (cycle.state !== "draft") {
    throw new DomainConflictError(
      "Só é possível editar datas de diagnósticos em rascunho.",
    );
  }

  const startsAt =
    input.startsAt !== undefined ? input.startsAt : cycle.startsAt;
  const responseDeadlineAt =
    input.responseDeadlineAt !== undefined
      ? input.responseDeadlineAt
      : cycle.responseDeadlineAt;
  const validationDeadlineAt =
    input.validationDeadlineAt !== undefined
      ? input.validationDeadlineAt
      : cycle.validationDeadlineAt;
  const cycleCloseAt =
    input.cycleCloseAt !== undefined ? input.cycleCloseAt : cycle.cycleCloseAt;

  const startDate = parseInstant(startsAt);
  const deadlineDate = parseInstant(responseDeadlineAt);
  const validationDate = parseInstant(validationDeadlineAt);
  const closeDate = parseInstant(cycleCloseAt);
  if (startsAt && !startDate) {
    throw new DomainValidationError([
      { path: "startsAt", message: "Data de início inválida." },
    ]);
  }
  if (responseDeadlineAt && !deadlineDate) {
    throw new DomainValidationError([
      { path: "responseDeadlineAt", message: "Prazo de resposta inválido." },
    ]);
  }
  if (validationDeadlineAt && !validationDate) {
    throw new DomainValidationError([
      { path: "validationDeadlineAt", message: "Data de validação automática inválida." },
    ]);
  }
  if (cycleCloseAt && !closeDate) {
    throw new DomainValidationError([
      { path: "cycleCloseAt", message: "Data de encerramento automático inválida." },
    ]);
  }
  if (startDate && deadlineDate && deadlineDate < startDate) {
    throw new DomainValidationError([
      {
        path: "responseDeadlineAt",
        message: "O prazo de resposta não pode ser anterior ao início.",
      },
    ]);
  }
  if (deadlineDate && deadlineDate.getTime() <= Date.now()) {
    throw new DomainValidationError([
      {
        path: "responseDeadlineAt",
        message: "O prazo de resposta deve estar no futuro.",
      },
    ]);
  }
  if (validationDate && (!deadlineDate || validationDate <= deadlineDate)) {
    throw new DomainValidationError([
      {
        path: "validationDeadlineAt",
        message: "A validação automática deve ser posterior ao prazo de resposta.",
      },
    ]);
  }
  if (closeDate && (!validationDate || closeDate <= validationDate)) {
    throw new DomainValidationError([
      {
        path: "cycleCloseAt",
        message: "O encerramento automático deve ser posterior à validação programada.",
      },
    ]);
  }

  const { data, error } = await supabase.rpc("update_cycle_schedule", {
    p_cycle_id: cycleId,
    p_starts_at: startsAt ?? null,
    p_response_deadline_at: responseDeadlineAt ?? null,
    p_validation_deadline_at: validationDeadlineAt ?? null,
    p_cycle_close_at: cycleCloseAt ?? null,
    p_actor_user_id: input.actorUserId,
  });
  if (error) {
    if (hasDatabaseErrorCode(error, "cycle_schedule_not_draft")) {
      throw new DomainConflictError(
        "O diagnóstico não está mais em rascunho. Recarregue e tente novamente.",
      );
    }
    if (hasDatabaseErrorCode(error, "validation_deadline_must_follow_response_deadline")) {
      throw new DomainValidationError([
        {
          path: "validationDeadlineAt",
          message: "A validação automática deve ser posterior ao prazo de resposta.",
        },
      ]);
    }
    if (hasDatabaseErrorCode(error, "cycle_close_must_follow_validation_deadline")) {
      throw new DomainValidationError([
        {
          path: "cycleCloseAt",
          message: "O encerramento automático deve ser posterior à validação programada.",
        },
      ]);
    }
    if (hasDatabaseErrorCode(error, "response_deadline_must_be_future")) {
      throw new DomainValidationError([
        {
          path: "responseDeadlineAt",
          message: "O prazo de resposta deve estar no futuro.",
        },
      ]);
    }
    throw error;
  }
  if (!data) {
    throw new DomainConflictError(
      "O diagnóstico não está mais em rascunho. Recarregue e tente novamente.",
    );
  }

  logInfo("cycle.schedule_updated", {
    cycleId,
    actorUserId: input.actorUserId,
    startsAt: data.starts_at,
    responseDeadlineAt: data.response_deadline_at,
    validationDeadlineAt: data.validation_deadline_at,
    cycleCloseAt: data.cycle_close_at,
  });

  return {
    id: data.id as string,
    startsAt: (data.starts_at as string | null) ?? null,
    responseDeadlineAt: (data.response_deadline_at as string | null) ?? null,
    validationDeadlineAt: (data.validation_deadline_at as string | null) ?? null,
    cycleCloseAt: (data.cycle_close_at as string | null) ?? null,
  };
}
