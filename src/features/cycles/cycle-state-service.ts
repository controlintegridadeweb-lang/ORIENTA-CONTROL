import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import {
  DomainConflictError,
  DomainNotFoundError,
} from "@/infrastructure/api/domain-errors";
import {
  allowedTransitions,
  canReopen,
  canTransition,
  isRespondentSubmissionTransition,
} from "@/shared/domain/workflow";
import type { CycleState } from "@/shared/domain/types";
import { cycleStateLabelOrFallback } from "@/shared/domain/cycle-labels";
import { logInfo } from "@/infrastructure/observability/logger";
import { collectSubmissionQuestions } from "@/features/cycles/submission-collect";
import { evaluateSubmissionReadiness } from "@/shared/domain/submission";

export type CycleRow = {
  id: string;
  formVersionId: string;
  organizationId: string;
  periodLabel: string;
  state: CycleState;
  reopenCount: number;
  startsAt: string | null;
  responseDeadlineAt: string | null;
  validationDeadlineAt: string | null;
  cycleCloseAt: string | null;
  deadlinePolicy: "flexible_audited";
  submittedLateAt: string | null;
  submissionDelaySeconds: number | null;
  submittedAt: string | null;
  validatedAt: string | null;
  closedAt: string | null;
  reopenedAt: string | null;
  responseCollectionPausedAt: string | null;
};

const SELECT_COLS =
  "id, form_version_id, organization_id, period_label, state, reopen_count, " +
  "starts_at, response_deadline_at, validation_deadline_at, cycle_close_at, " +
  "deadline_policy, submitted_late_at, " +
  "submission_delay_seconds, submitted_at, validated_at, closed_at, reopened_at, " +
  "response_collection_paused_at";

const cycleRowSchema = z.object({
  id: z.string().min(1),
  form_version_id: z.string().min(1),
  organization_id: z.string().min(1),
  period_label: z.string(),
  state: z.enum([
    "draft",
    "in_response",
    "submitted",
    "in_validation",
    "awaiting_adjustment",
    "validated",
    "completed",
  ]),
  reopen_count: z.number().int().nonnegative().default(0),
  starts_at: z.string().nullable(),
  response_deadline_at: z.string().nullable(),
  validation_deadline_at: z.string().nullable(),
  cycle_close_at: z.string().nullable(),
  deadline_policy: z.literal("flexible_audited"),
  submitted_late_at: z.string().nullable(),
  submission_delay_seconds: z.number().int().nonnegative().nullable(),
  submitted_at: z.string().nullable(),
  validated_at: z.string().nullable(),
  closed_at: z.string().nullable(),
  reopened_at: z.string().nullable(),
  response_collection_paused_at: z.string().nullable().optional(),
});

const scheduledCycleActionResultSchema = z.object({
  status: z.enum(["succeeded", "skipped", "failed"]),
  fromState: z.string().nullable(),
  toState: z.string().nullable(),
  message: z.string(),
});

export type ScheduledCycleAction =
  | "open_cycle"
  | "finalize_validation"
  | "close_cycle";

export type ScheduledCycleActionResult = z.infer<
  typeof scheduledCycleActionResultSchema
>;

function mapRow(raw: unknown): CycleRow {
  const row = cycleRowSchema.parse(raw);
  return {
    id: row.id,
    formVersionId: row.form_version_id,
    organizationId: row.organization_id,
    periodLabel: row.period_label,
    state: row.state,
    reopenCount: row.reopen_count,
    startsAt: row.starts_at,
    responseDeadlineAt: row.response_deadline_at,
    validationDeadlineAt: row.validation_deadline_at,
    cycleCloseAt: row.cycle_close_at,
    deadlinePolicy: row.deadline_policy,
    submittedLateAt: row.submitted_late_at,
    submissionDelaySeconds: row.submission_delay_seconds,
    submittedAt: row.submitted_at,
    validatedAt: row.validated_at,
    closedAt: row.closed_at,
    reopenedAt: row.reopened_at,
    responseCollectionPausedAt: row.response_collection_paused_at ?? null,
  };
}

/**
 * Gatekeeper único de transições do Ciclo, cycle-cêntrico.
 * Sem `ensure`, `deriveFormState` nem `resyncFormState`.
 */
export class CycleStateService {
  protected supabase: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.supabase = client ?? createSupabaseServiceRoleClient();
  }

  async find(cycleId: string): Promise<CycleRow | null> {
    const { data, error } = await this.supabase
      .from("cycles")
      .select(SELECT_COLS)
      .eq("id", cycleId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRow(data) : null;
  }

  async require(cycleId: string): Promise<CycleRow> {
    const cycle = await this.find(cycleId);
    if (!cycle) {
      throw new DomainNotFoundError("Diagnóstico não encontrado.");
    }
    return cycle;
  }

  /** Carrega vários diagnósticos em uma única consulta, preservando a ordem solicitada. */
  async findMany(cycleIds: string[]): Promise<CycleRow[]> {
    const ids = Array.from(new Set(cycleIds));
    if (ids.length === 0) return [];

    const { data, error } = await this.supabase
      .from("cycles")
      .select(SELECT_COLS)
      .in("id", ids);
    if (error) throw error;

    const byId = new Map((data ?? []).map((row) => {
      const cycle = mapRow(row);
      return [cycle.id, cycle] as const;
    }));
    return ids.flatMap((id) => {
      const cycle = byId.get(id);
      return cycle ? [cycle] : [];
    });
  }


  /**
   * Preview puro (sem mutação) da guarda de transição do ciclo.
   *
   * Usa a mesma fonte de verdade de `transition` (`canTransition` /
   * `allowedTransitions`, em paridade com a guarda SQL `cycle_can_transition`),
   * de modo que o resultado do preview e o da execução nunca divergem. Serve à
   * rota `/api/cycles/[id]/readiness` para habilitar/desabilitar ações na UI.
   */
  checkReadiness(
    cycle: CycleRow,
    to: CycleState,
  ): { allowed: boolean; reason: string | null } {
    const from = cycle.state;
    if (from === to) {
      return { allowed: false, reason: "O diagnóstico já está neste estado." };
    }
    // A reabertura é uma transição excepcional: não integra o mapa de avanço
    // canônico, mas é uma operação oficial de completed → in_response.
    if (to === "in_response" && canReopen(from)) {
      return { allowed: true, reason: null };
    }
    if (!canTransition(from, to)) {
      const valid = allowedTransitions(from)
        .map((state) => cycleStateLabelOrFallback(state))
        .join(", ") || "nenhuma (estado terminal)";
      return {
        allowed: false,
        reason: `Não é possível alterar o diagnóstico de ${cycleStateLabelOrFallback(from)} para ${cycleStateLabelOrFallback(to)}. Próximos estados permitidos: ${valid}.`,
      };
    }
    if (
      from === "draft" &&
      to === "in_response" &&
      (!cycle.startsAt || !cycle.responseDeadlineAt)
    ) {
      return {
        allowed: false,
        reason: "Defina início e prazo de resposta antes de abrir o diagnóstico.",
      };
    }
    return { allowed: true, reason: null };
  }


  async findByIdentity(
    formVersionId: string,
    organizationId: string,
    periodLabel: string,
  ): Promise<CycleRow | null> {
    const { data, error } = await this.supabase
      .from("cycles")
      .select(SELECT_COLS)
      .eq("form_version_id", formVersionId)
      .eq("organization_id", organizationId)
      .eq("period_label", periodLabel)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRow(data) : null;
  }


  async transition(
    cycle: CycleRow,
    to: CycleState,
    actorUserId: string,
  ): Promise<CycleRow> {
    const from = cycle.state;
    if (from === to) return cycle;

    // `validated → completed` encerra somente o ciclo de acompanhamento.
    // O FAMI e os snapshots já foram congelados na conclusão da validação.

    if (isRespondentSubmissionTransition(from, to)) {
      throw new DomainConflictError(
        "O envio do diagnóstico deve ser realizado pelo respondente após a validação das pendências.",
      );
    }

    if (from === "in_validation") {
      throw new DomainConflictError(
        "Solicite ajustes e consolide o diagnóstico exclusivamente pela fila de validação de evidências.",
      );
    }

    const readiness = this.checkReadiness(cycle, to);
    if (!readiness.allowed) {
      throw new DomainConflictError(
        readiness.reason ?? "A transição do diagnóstico não está pronta.",
      );
    }

    if (!canTransition(from, to)) {
      throw new DomainConflictError(
        `Não é possível alterar o diagnóstico de ${cycleStateLabelOrFallback(from)} para ${cycleStateLabelOrFallback(to)}.`,
      );
    }

    const { error } = await this.supabase.rpc("commit_cycle_transition", {
      p_cycle_id: cycle.id,
      p_actor_user_id: actorUserId,
      p_to_state: to,
      p_fami_rows: null,
      p_snapshot_payload: null,
      p_expected_from_state: from,
    });
    if (error) {
      const msg = (error as { message?: string }).message ?? "";
      if (
        hasDatabaseErrorCode(msg, "cycle_state_conflict") ||
        hasDatabaseErrorCode(msg, "invalid_cycle_transition")
      ) {
        throw new DomainConflictError(
          "O diagnóstico mudou de estado ou a transição não é permitida. Recarregue e tente novamente.",
        );
      }
      if (hasDatabaseErrorCode(msg, "cycle_close_requires_finalized_diagnosis")) {
        throw new DomainConflictError(
          "Conclua a validação e calcule o FAMI antes de encerrar a avaliação.",
        );
      }
      if (hasDatabaseErrorCode(msg, "close_requires_reference_period")) {
        throw new DomainConflictError(
          "Defina o período de referência institucional antes de encerrar a avaliação.",
        );
      }
      if (hasDatabaseErrorCode(msg, "close_requires_completed_and_approved_action_plans")) {
        throw new DomainConflictError(
          "Conclua as ações, resolva as solicitações abertas e registre o aceite da supervisão antes de encerrar a avaliação.",
        );
      }
      if (hasDatabaseErrorCode(msg, "close_waiver_snapshot_conflict")) {
        throw new DomainConflictError(
          "As dispensas mudaram depois da conclusão do diagnóstico. Revise o histórico antes de encerrar a avaliação.",
        );
      }
      throw error;
    }

    logInfo("cycle.transitioned", {
      cycleId: cycle.id,
      formVersionId: cycle.formVersionId,
      organizationId: cycle.organizationId,
      from,
      to,
      actorUserId,
    });

    return this.require(cycle.id);
  }

  async transitionById(
    cycleId: string,
    to: CycleState,
    actorUserId: string,
  ): Promise<CycleRow> {
    const cycle = await this.require(cycleId);
    return this.transition(cycle, to, actorUserId);
  }

  /**
   * Conclui a validação e materializa o diagnóstico oficial.
   *
   * O banco bloqueia o diagnóstico, calcula o FAMI pelo estado vivo, congela
   * os snapshots, sincroniza recomendações e transiciona
   * `in_validation → validated` na mesma transação.
   */
  async consolidateValidation(cycle: CycleRow, actorUserId: string): Promise<CycleRow> {
    if (cycle.state !== "in_validation") {
      throw new DomainConflictError(
        "A conclusão do diagnóstico está disponível somente durante a validação.",
      );
    }

    const submissionQuestions = await collectSubmissionQuestions(
      this.supabase,
      cycle.id,
    );
    const readiness = evaluateSubmissionReadiness(submissionQuestions);
    if (!readiness.ready) {
      throw new DomainConflictError(
        "Ainda existem respostas ou correções pendentes. Resolva-as antes de concluir a validação.",
      );
    }

    const { error } = await this.supabase.rpc("finalize_validation_cycle", {
      p_cycle_id: cycle.id,
      p_actor_user_id: actorUserId,
    });
    if (error) {
      const message = (error as { message?: string }).message ?? "";
      if (
        hasDatabaseErrorCode(message, "validation_pending_evidence") ||
        hasDatabaseErrorCode(message, "validation_unresolved_evidence") ||
        hasDatabaseErrorCode(message, "validation_has_unresolved_evidence")
      ) {
        throw new DomainConflictError(
          "Avalie as evidências pendentes e aguarde a correção dos ajustes solicitados antes de concluir a validação do diagnóstico.",
        );
      }
      if (hasDatabaseErrorCode(message, "validation_unresolved_na")) {
        throw new DomainConflictError(
          "Avalie as respostas “não se aplica” pendentes antes de concluir a validação do diagnóstico.",
        );
      }
      if (hasDatabaseErrorCode(message, "validation_incomplete_submission")) {
        throw new DomainConflictError(
          "Ainda existem critérios sem resposta. Revise o diagnóstico antes de concluir a validação.",
        );
      }
      if (
        hasDatabaseErrorCode(message, "cycle_not_ready_for_validation_finalization") ||
        hasDatabaseErrorCode(message, "cycle_state_conflict") ||
        hasDatabaseErrorCode(message, "validated_cycle_without_finalized_processing")
      ) {
        throw new DomainConflictError(
          "O diagnóstico não está mais disponível para conclusão. Atualize a página e tente novamente.",
        );
      }
      if (hasDatabaseErrorCode(message, "validation_fami_materialization_failed")) {
        throw new DomainConflictError(
          "Não foi possível materializar o FAMI do diagnóstico. Atualize a página e tente novamente.",
        );
      }
      if (hasDatabaseErrorCode(message, "recommendation_binding_missing")) {
        throw new DomainConflictError(
          "Há critério publicado sem recomendação-base. Corrija a versão do formulário antes de concluir o diagnóstico.",
        );
      }
      throw error;
    }

    return this.require(cycle.id);
  }

  async reopen(
    cycleId: string,
    actorUserId: string,
    input: {
      reason: string;
      responseDeadlineAt: string;
      questionVersionIds?: string[] | null;
    },
  ): Promise<CycleRow> {
    const { error } = await this.supabase.rpc("reopen_cycle", {
      p_cycle_id: cycleId,
      p_actor_user_id: actorUserId,
      p_reason: input.reason,
      p_response_deadline_at: input.responseDeadlineAt,
      p_question_version_ids: input.questionVersionIds?.length
        ? input.questionVersionIds
        : null,
    });
    if (error) {
      const msg = (error as { message?: string }).message ?? "";
      if (hasDatabaseErrorCode(msg, "cycle_not_found")) {
        throw new DomainNotFoundError("Diagnóstico não encontrado.");
      }
      if (hasDatabaseErrorCode(msg, "cannot_reopen")) {
        throw new DomainConflictError(
          "Somente diagnósticos concluídos podem ser reabertos.",
        );
      }
      if (hasDatabaseErrorCode(msg, "reopen_reason_required")) {
        throw new DomainConflictError(
          "Informe uma justificativa com pelo menos 10 caracteres para reabrir o diagnóstico.",
        );
      }
      if (hasDatabaseErrorCode(msg, "reopen_deadline_must_be_future")) {
        throw new DomainConflictError(
          "Informe um novo prazo futuro para a reabertura.",
        );
      }
      if (hasDatabaseErrorCode(msg, "reopen_requires_official_report")) {
        throw new DomainConflictError(
          "Conclua a emissão do relatório oficial antes de reabrir o diagnóstico. O documento do encerramento atual precisa permanecer preservado no histórico.",
        );
      }
      throw error;
    }

    const reopened = await this.require(cycleId);
    logInfo("cycle.reopened", {
      cycleId,
      reopenCount: reopened.reopenCount,
      actorUserId,
      responseDeadlineAt: input.responseDeadlineAt,
      reasonLength: input.reason.trim().length,
    });
    return reopened;
  }

  /**
   * Reabre a validação concluída (`validated → in_validation`).
   *
   * Preserva decisões e o FAMI do processamento anterior; cria um novo
   * `cycle_processings` em `working`. O FAMI oficial só volta após nova
   * consolidação.
   */
  async reopenValidation(
    cycleId: string,
    actorUserId: string,
    input: { reason: string },
  ): Promise<CycleRow> {
    const { error } = await this.supabase.rpc("reopen_validation_cycle", {
      p_cycle_id: cycleId,
      p_actor_user_id: actorUserId,
      p_reason: input.reason,
    });
    if (error) {
      const msg = (error as { message?: string }).message ?? "";
      if (hasDatabaseErrorCode(msg, "cycle_not_found")) {
        throw new DomainNotFoundError("Diagnóstico não encontrado.");
      }
      if (hasDatabaseErrorCode(msg, "validation_reopen_actor_not_authorized")) {
        throw new DomainConflictError(
          "Somente administradores podem reabrir a validação.",
        );
      }
      if (
        hasDatabaseErrorCode(msg, "validation_already_open") ||
        hasDatabaseErrorCode(msg, "validation_reopen_working_processing_exists")
      ) {
        throw new DomainConflictError(
          "A situação deste diagnóstico foi alterada por outro usuário. Atualize a página antes de continuar.",
        );
      }
      if (hasDatabaseErrorCode(msg, "cannot_reopen_validation")) {
        throw new DomainConflictError(
          "A situação deste diagnóstico foi alterada por outro usuário. Atualize a página antes de continuar.",
        );
      }
      if (
        hasDatabaseErrorCode(msg, "validation_reopen_reason_required") ||
        hasDatabaseErrorCode(msg, "validation_reopen_reason_too_long")
      ) {
        throw new DomainConflictError(
          "Informe uma justificativa com pelo menos 10 caracteres para reabrir a validação.",
        );
      }
      if (hasDatabaseErrorCode(msg, "validation_reopen_has_improvement_history")) {
        throw new DomainConflictError(
          "A validação não pode ser reaberta porque já existem ações, registros de supervisão ou exceções vinculados ao resultado oficial. Preserve o histórico e abra um novo diagnóstico para uma nova avaliação.",
        );
      }
      if (hasDatabaseErrorCode(msg, "validation_reopen_requires_completed_processing")) {
        throw new DomainConflictError(
          "Não há Resultado FAMI concluído para preservar. Atualize a página e tente novamente.",
        );
      }
      throw error;
    }

    const reopened = await this.require(cycleId);
    logInfo("cycle.validation_reopened", {
      cycleId,
      actorUserId,
      reasonLength: input.reason.trim().length,
    });
    return reopened;
  }

  async executeScheduledAction(input: {
    cycleId: string;
    actorUserId: string;
    action: ScheduledCycleAction;
    expectedScheduleRevision: number;
  }): Promise<ScheduledCycleActionResult> {
    const { data, error } = await this.supabase.rpc("execute_scheduled_cycle_action", {
      p_cycle_id: input.cycleId,
      p_actor_user_id: input.actorUserId,
      p_action: input.action,
      p_expected_schedule_revision: input.expectedScheduleRevision,
    });
    if (error) throw error;
    return scheduledCycleActionResultSchema.parse(data);
  }

  async listForFormVersion(formVersionId: string): Promise<CycleRow[]> {
    const { data, error } = await this.supabase
      .from("cycles")
      .select(SELECT_COLS)
      .eq("form_version_id", formVersionId);
    if (error) throw error;
    return (data ?? []).map((row) => mapRow(row));
  }

  async listForOrganization(organizationId: string): Promise<CycleRow[]> {
    const { data, error } = await this.supabase
      .from("cycles")
      .select(SELECT_COLS)
      .eq("organization_id", organizationId)
      .order("period_label", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapRow(row));
  }
}
