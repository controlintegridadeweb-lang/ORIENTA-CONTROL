import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DomainConflictError,
  DomainValidationError,
} from "@/infrastructure/api/domain-errors";
import { listCycles } from "@/features/cycles/cycle-queries";
import { selectLatestCyclePerOrganization } from "@/features/cycles/dashboard-model";
import {
  resolveDeadlineScopeCycleIds,
  resolveReopenEligibleCycles,
  resolveValidationReopenEligibleCycles,
  validateFutureDeadline,
  validateJustification,
  validatePartialReopenScope,
  type DeadlineScope,
  type FormManagementCycleInput,
} from "./domain";
import type { FormManagementMutationResult } from "./types";

type DeadlineAction = "change_deadline" | "extend_deadline" | "early_close";

function toDomainCycles(
  cycles: Awaited<ReturnType<typeof listCycles>>,
): FormManagementCycleInput[] {
  return cycles.map((cycle) => ({
    id: cycle.id,
    organizationId: cycle.organizationId,
    state: cycle.state,
    responseDeadlineAt: cycle.responseDeadlineAt,
    originalResponseDeadlineAt: cycle.originalResponseDeadlineAt,
    responseCollectionPausedAt: cycle.responseCollectionPausedAt,
    deadlineChangeCount: cycle.deadlineChangeCount,
    reopenCount: cycle.reopenCount,
    startsAt: cycle.startsAt,
    closedAt: cycle.closedAt,
  }));
}

async function loadScopedCycles(
  supabase: SupabaseClient,
  formId: string,
  periodLabel: string,
) {
  return selectLatestCyclePerOrganization(
    await listCycles(supabase, { formId, periodLabel }),
  );
}

const EVIDENCE_BUCKET = "evidencias";
const REPORTS_BUCKET = "relatorios";
const ACTION_PLAN_DOCUMENT_BUCKET = "planos-acao";

function storagePaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

async function removeStoragePaths(
  supabase: SupabaseClient,
  bucket: string,
  paths: string[],
) {
  const unique = [...new Set(paths)];
  for (let index = 0; index < unique.length; index += 100) {
    const chunk = unique.slice(index, index + 100);
    await supabase.storage.from(bucket).remove(chunk);
  }
}

function mapRpcError(error: { message?: string } | null, fallback: string): never {
  const message = error?.message ?? "";
  if (hasDatabaseErrorCode(message, "form_collection_not_fully_suspended")) {
    throw new DomainConflictError(
      "Suspenda a coleta de todas as organizações em preenchimento ou correção antes de despublicar ou excluir.",
    );
  }
  if (hasDatabaseErrorCode(message, "form_not_published")) {
    throw new DomainConflictError("O formulário já não está publicado.");
  }
  if (hasDatabaseErrorCode(message, "form_not_found")) {
    throw new DomainConflictError("Formulário não encontrado.");
  }
  if (
    hasDatabaseErrorCode(message, "unpublish_justification_required") ||
    hasDatabaseErrorCode(message, "delete_justification_required")
  ) {
    throw new DomainValidationError([
      { path: "justification", message: "Informe a justificativa administrativa." },
    ]);
  }
  if (hasDatabaseErrorCode(message, "deadline_must_be_future") || hasDatabaseErrorCode(message, "reopen_deadline_must_be_future")) {
    throw new DomainValidationError([
      { path: "newDeadlineAt", message: "O novo prazo deve ser posterior ao momento atual." },
    ]);
  }
  if (
    hasDatabaseErrorCode(message, "deadline_justification_required") ||
    hasDatabaseErrorCode(message, "reopen_reason_required") ||
    hasDatabaseErrorCode(message, "pause_justification_required")
  ) {
    throw new DomainValidationError([
      { path: "justification", message: "Informe a justificativa administrativa." },
    ]);
  }
  if (hasDatabaseErrorCode(message, "reopen_requires_validation_round")) {
    throw new DomainConflictError(
      "Há órgãos com validação/FAMI concluídos. Reabra a validação (nova rodada) nesses órgãos antes da recoleta.",
    );
  }
  if (hasDatabaseErrorCode(message, "deadline_cycle_paused")) {
    throw new DomainConflictError(
      "Há organizações com coleta suspensa. Retome antes de alterar o prazo.",
    );
  }
  if (hasDatabaseErrorCode(message, "deadline_extend_requires_overdue")) {
    throw new DomainConflictError(
      "A prorrogação exige organizações com prazo vencido.",
    );
  }
  throw new DomainConflictError(fallback);
}

export async function changeFormApplicationDeadlines(
  supabase: SupabaseClient,
  input: {
    formId: string;
    periodLabel: string;
    action: DeadlineAction;
    scope: DeadlineScope;
    organizationIds?: string[];
    newDeadlineAt: string | null;
    justification: string;
    actorUserId: string;
  },
): Promise<FormManagementMutationResult> {
  const justificationError = validateJustification(input.justification);
  if (justificationError) {
    throw new DomainValidationError([
      { path: "justification", message: justificationError },
    ]);
  }

  if (input.action !== "early_close") {
    if (!input.newDeadlineAt) {
      throw new DomainValidationError([
        { path: "newDeadlineAt", message: "Informe a nova data e horário." },
      ]);
    }
    const deadlineError = validateFutureDeadline(input.newDeadlineAt);
    if (deadlineError) {
      throw new DomainValidationError([
        { path: "newDeadlineAt", message: deadlineError },
      ]);
    }
  }

  const cycles = await loadScopedCycles(supabase, input.formId, input.periodLabel);
  const scopeResolved = resolveDeadlineScopeCycleIds({
    cycles: toDomainCycles(cycles),
    scope: input.action === "extend_deadline" && input.scope === "all" ? "overdue" : input.scope,
    organizationIds: input.organizationIds,
  });
  if (scopeResolved.error || scopeResolved.cycleIds.length === 0) {
    throw new DomainConflictError(
      scopeResolved.error ?? "Nenhuma organização elegível para a alteração de prazo.",
    );
  }

  const { data, error } = await supabase.rpc("admin_change_cycle_response_deadlines", {
    p_cycle_ids: scopeResolved.cycleIds,
    p_new_deadline_at: input.action === "early_close" ? null : input.newDeadlineAt,
    p_action: input.action,
    p_scope: input.scope,
    p_justification: input.justification.trim(),
    p_actor_user_id: input.actorUserId,
  });
  if (error) mapRpcError(error, "Não foi possível alterar o prazo.");

  const payload = (data ?? {}) as {
    batchId?: string;
    updated?: number;
    notifications?: number;
    action?: string;
    newDeadlineAt?: string | null;
  };

  return {
    batchId: payload.batchId ?? "",
    updated: Number(payload.updated ?? 0),
    notifications: Number(payload.notifications ?? 0),
    action: payload.action ?? input.action,
    newDeadlineAt: payload.newDeadlineAt ?? input.newDeadlineAt,
  };
}

export async function setFormApplicationCollectionPause(
  supabase: SupabaseClient,
  input: {
    formId: string;
    periodLabel: string;
    pause: boolean;
    scope?: DeadlineScope;
    organizationIds?: string[];
    justification: string;
    actorUserId: string;
  },
): Promise<FormManagementMutationResult> {
  const justificationError = validateJustification(input.justification);
  if (justificationError) {
    throw new DomainValidationError([
      { path: "justification", message: justificationError },
    ]);
  }

  const cycles = await loadScopedCycles(supabase, input.formId, input.periodLabel);
  const domain = toDomainCycles(cycles);
  const scope = input.scope ?? "all";
  const target =
    scope === "all"
      ? domain.filter((cycle) =>
          cycle.state === "in_response" || cycle.state === "awaiting_adjustment",
        )
      : domain.filter((cycle) =>
          (input.organizationIds ?? []).includes(cycle.organizationId),
        );

  const cycleIds = target
    .filter((cycle) =>
      input.pause
        ? !cycle.responseCollectionPausedAt
        : Boolean(cycle.responseCollectionPausedAt),
    )
    .map((cycle) => cycle.id);

  if (cycleIds.length === 0) {
    throw new DomainConflictError(
      input.pause
        ? "Não há organizações em coleta para suspender."
        : "Não há organizações suspensas para retomar.",
    );
  }

  const { data, error } = await supabase.rpc("admin_set_cycle_collection_pause", {
    p_cycle_ids: cycleIds,
    p_pause: input.pause,
    p_scope: scope,
    p_justification: input.justification.trim(),
    p_actor_user_id: input.actorUserId,
  });
  if (error) mapRpcError(error, "Não foi possível atualizar a suspensão da coleta.");

  const payload = (data ?? {}) as {
    batchId?: string;
    updated?: number;
    notifications?: number;
    action?: string;
  };

  return {
    batchId: payload.batchId ?? "",
    updated: Number(payload.updated ?? 0),
    notifications: Number(payload.notifications ?? 0),
    action: payload.action ?? (input.pause ? "suspend" : "resume"),
  };
}

export async function reopenFormApplicationResponses(
  supabase: SupabaseClient,
  input: {
    formId: string;
    periodLabel: string;
    scope: DeadlineScope;
    organizationIds?: string[];
    newDeadlineAt: string;
    justification: string;
    actorUserId: string;
    reopenMode?: "full" | "partial";
    questionVersionIds?: string[];
  },
): Promise<FormManagementMutationResult> {
  const justificationError = validateJustification(input.justification);
  if (justificationError) {
    throw new DomainValidationError([
      { path: "justification", message: justificationError },
    ]);
  }
  const deadlineError = validateFutureDeadline(input.newDeadlineAt);
  if (deadlineError) {
    throw new DomainValidationError([
      { path: "newDeadlineAt", message: deadlineError },
    ]);
  }
  const reopenMode = input.reopenMode ?? "full";
  const questionVersionIds = [...new Set(input.questionVersionIds ?? [])];
  const scopeError = validatePartialReopenScope({
    mode: reopenMode,
    questionVersionIds,
  });
  if (scopeError) {
    throw new DomainValidationError([
      { path: "questionVersionIds", message: scopeError },
    ]);
  }

  const cycles = await loadScopedCycles(supabase, input.formId, input.periodLabel);
  const domain = toDomainCycles(cycles);
  const organizationIds =
    input.scope === "all" ? undefined : input.organizationIds;
  const { cycleIds, blocked } = resolveReopenEligibleCycles(domain, organizationIds);

  if (cycleIds.length === 0) {
    throw new DomainConflictError(
      blocked[0]?.reason ??
        "Nenhuma organização elegível para reabertura. Órgãos com FAMI/validação concluídos exigem nova rodada de validação.",
    );
  }

  const { data, error } = await supabase.rpc("admin_reopen_cycles_for_responses", {
    p_cycle_ids: cycleIds,
    p_new_deadline_at: input.newDeadlineAt,
    p_scope: input.scope,
    p_justification: input.justification.trim(),
    p_actor_user_id: input.actorUserId,
    p_question_version_ids: reopenMode === "partial" ? questionVersionIds : null,
  });
  if (error) mapRpcError(error, "Não foi possível reabrir para respostas.");

  const payload = (data ?? {}) as {
    batchId?: string;
    reopened?: number;
    notifications?: number;
    newDeadlineAt?: string | null;
  };

  return {
    batchId: payload.batchId ?? "",
    updated: Number(payload.reopened ?? 0),
    reopened: Number(payload.reopened ?? 0),
    notifications: Number(payload.notifications ?? 0),
    action: "reopen_responses",
    newDeadlineAt: payload.newDeadlineAt ?? input.newDeadlineAt,
  };
}

export async function reopenFormApplicationValidation(
  supabase: SupabaseClient,
  input: {
    formId: string;
    periodLabel: string;
    scope: DeadlineScope;
    organizationIds?: string[];
    justification: string;
    actorUserId: string;
  },
): Promise<FormManagementMutationResult> {
  const justificationError = validateJustification(input.justification);
  if (justificationError) {
    throw new DomainValidationError([
      { path: "justification", message: justificationError },
    ]);
  }

  const cycles = await loadScopedCycles(supabase, input.formId, input.periodLabel);
  const domain = toDomainCycles(cycles);
  const organizationIds =
    input.scope === "all" ? undefined : input.organizationIds;
  const { cycleIds, blocked } = resolveValidationReopenEligibleCycles(
    domain,
    organizationIds,
  );

  if (cycleIds.length === 0) {
    throw new DomainConflictError(
      blocked[0]?.reason ??
        "Nenhum órgão elegível para reabertura de validação.",
    );
  }

  const { data, error } = await supabase.rpc("admin_reopen_validation_cycles", {
    p_cycle_ids: cycleIds,
    p_scope: input.scope,
    p_justification: input.justification.trim(),
    p_actor_user_id: input.actorUserId,
  });
  if (error) mapRpcError(error, "Não foi possível reabrir a validação.");

  const payload = (data ?? {}) as {
    batchId?: string;
    reopened?: number;
    action?: string;
  };

  return {
    batchId: payload.batchId ?? "",
    updated: Number(payload.reopened ?? 0),
    reopened: Number(payload.reopened ?? 0),
    action: payload.action ?? "reopen_validation",
  };
}

function requireWithdrawalJustification(justification: string) {
  const justificationError = validateJustification(justification);
  if (justificationError) {
    throw new DomainValidationError([
      { path: "justification", message: justificationError },
    ]);
  }
}

export async function unpublishSuspendedForm(
  supabase: SupabaseClient,
  input: { formId: string; justification: string; actorUserId: string },
): Promise<FormManagementMutationResult> {
  requireWithdrawalJustification(input.justification);
  const { data, error } = await supabase.rpc("admin_unpublish_suspended_form", {
    p_form_id: input.formId,
    p_justification: input.justification.trim(),
    p_actor_user_id: input.actorUserId,
  });
  if (error) mapRpcError(error, "Não foi possível despublicar o formulário.");
  const payload = (data ?? {}) as { batchId?: string; updated?: number; action?: string };
  return {
    batchId: payload.batchId ?? "",
    updated: Number(payload.updated ?? 0),
    action: payload.action ?? "unpublish",
  };
}

export async function deleteSuspendedForm(
  supabase: SupabaseClient,
  input: { formId: string; justification: string; actorUserId: string },
): Promise<FormManagementMutationResult> {
  requireWithdrawalJustification(input.justification);
  const { data, error } = await supabase.rpc("admin_delete_suspended_form", {
    p_form_id: input.formId,
    p_justification: input.justification.trim(),
    p_actor_user_id: input.actorUserId,
  });
  if (error) mapRpcError(error, "Não foi possível excluir o formulário.");
  const payload = (data ?? {}) as {
    batchId?: string;
    updated?: number;
    action?: string;
    evidencePaths?: unknown;
    reportPaths?: unknown;
    actionPlanPaths?: unknown;
  };
  await removeStoragePaths(supabase, EVIDENCE_BUCKET, storagePaths(payload.evidencePaths));
  await removeStoragePaths(supabase, REPORTS_BUCKET, storagePaths(payload.reportPaths));
  await removeStoragePaths(
    supabase,
    ACTION_PLAN_DOCUMENT_BUCKET,
    storagePaths(payload.actionPlanPaths),
  );
  return {
    batchId: payload.batchId ?? "",
    updated: Number(payload.updated ?? 0),
    action: payload.action ?? "delete",
  };
}
