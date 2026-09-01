import { hasDatabaseErrorCode, isForeignKeyViolation } from "@/infrastructure/supabase/database-error";
/**
 * Comandos operacionais do plano de integridade e compliance.
 *
 * Casos de uso distintos (create / update_progress / edit_details / cancel)
 * convergem na RPC transacional, preservando autorização e revisão no banco.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DomainConflictError } from "@/infrastructure/api/domain-errors";
import { cycleStateLabelOrFallback } from "@/shared/domain/cycle-labels";
import {
  ACTION_PLAN_ELIGIBLE_STATES,
  isActionPlanEligible,
} from "@/shared/domain/workflow";
import { logInfo } from "@/infrastructure/observability/logger";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { loadRecommendationScope } from "./cycle-read-model";
import {
  respondentActionCommandSchema,
  deleteActionPlanSchema,
  type RespondentActionCommand,
} from "./schemas";
import {
  ActionPlansNotFoundError,
  ActionPlansValidationError,
  parseOrThrow,
} from "./access";
import { RESPONDENT_AXIS_UNRESOLVED_MESSAGE } from "./mappers";
import { parseResponsibleLabel } from "./plan-status-map";
import {
  PROGRESS_PERCENTAGE_CANNOT_DECREASE,
  assertProgressDoesNotDecrease,
  progressCannotDecreaseMessage,
} from "./plan-progress";

export type RespondentActionPlanCaller = {
  userId: string;
  role: "respondent";
  organizationId: string;
};

type SaveResult = { plan_id: string; mode: "created" | "updated"; revision: number };
type DeleteResult = { plan_id: string; mode: "deleted"; revision: number };

type PersistedActionRow = {
  id: string;
  recommendation_id: string;
  action_text: string;
  start_date: string;
  due_date: string;
  responsible_user_id: string | null;
  responsible_label: string | null;
  progress_percentage: number;
  status: string;
  execution_notes: string | null;
  revision: number;
};

type RpcSavePayload = {
  recommendationId: string;
  planId: string | null;
  expectedRevision: number | null;
  actionText: string;
  startDate: string;
  dueDate: string;
  responsibleSector: string;
  responsibleUserId: string;
  progressPercentage: number;
  cancelled: boolean;
  observations: string | null;
  progressUpdateDescription: string | null;
};

export class RespondentActionPlanCommandService {
  private readonly supabase: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.supabase = client ?? createSupabaseServiceRoleClient();
  }

  async save(
    rawPayload: unknown,
    caller: RespondentActionPlanCaller,
  ): Promise<{ planId: string; mode: "created" | "updated"; revision: number }> {
    const command = parseOrThrow(respondentActionCommandSchema, rawPayload);
    const rpcPayload = await this.resolveRpcPayload(command);
    return this.persistRpc(rpcPayload, caller);
  }

  async delete(
    rawPayload: unknown,
    caller: RespondentActionPlanCaller,
  ): Promise<{ planId: string; mode: "deleted"; revision: number }> {
    const payload = parseOrThrow(deleteActionPlanSchema, rawPayload);
    const scope = await loadRecommendationScope(this.supabase, payload.recommendationId);

    if (!scope || scope.organizationId !== caller.organizationId) {
      throw new ActionPlansNotFoundError("Recomendação não encontrada.");
    }

    if (!isActionPlanEligible(scope.cycleState as Parameters<typeof isActionPlanEligible>[0])) {
      const current = cycleStateLabelOrFallback(scope.cycleState);
      const eligibleStates = ACTION_PLAN_ELIGIBLE_STATES
        .map((state) => cycleStateLabelOrFallback(state))
        .join(" ou ");
      throw new DomainConflictError(
        `O plano de integridade e compliance só pode ser preenchido quando o diagnóstico estiver em ${eligibleStates} (estado atual: ${current}).`,
      );
    }

    const { data, error } = await this.supabase.rpc("delete_respondent_action_plan", {
      p_actor_user_id: caller.userId,
      p_organization_id: caller.organizationId,
      p_plan_id: payload.planId,
      p_recommendation_id: payload.recommendationId,
      p_expected_revision: payload.expectedRevision,
    });

    if (error) {
      this.throwMappedRpcError(error);
    }

    const row = (Array.isArray(data) ? data[0] : data) as DeleteResult | null;
    if (!row?.plan_id || row.mode !== "deleted" || !Number.isInteger(row.revision)) {
      throw new Error("A operação não retornou a exclusão do plano de integridade e compliance.");
    }

    logInfo("action_plans.respondent.deleted", {
      actorUserId: caller.userId,
      organizationId: caller.organizationId,
      recommendationId: payload.recommendationId,
      planId: row.plan_id,
    });

    return { planId: row.plan_id, mode: "deleted", revision: row.revision };
  }

  private async resolveRpcPayload(command: RespondentActionCommand): Promise<RpcSavePayload> {
    if (command.intent === "create") {
      return {
        recommendationId: command.recommendationId,
        planId: null,
        expectedRevision: null,
        actionText: command.actionText,
        startDate: command.startDate,
        dueDate: command.dueDate,
        responsibleSector: command.responsibleSector,
        responsibleUserId: command.responsibleUserId,
        progressPercentage: 0,
        cancelled: false,
        observations: null,
        progressUpdateDescription: null,
      };
    }

    const existing = await this.loadPersistedAction(
      command.planId,
      command.recommendationId,
    );
    if (existing.status === "cancelled" && command.intent !== "cancel") {
      throw new DomainConflictError("Esta ação está cancelada e não pode ser alterada.");
    }

    if (command.intent === "update_progress") {
      const { sector } = parseResponsibleLabel(String(existing.responsible_label ?? ""));
      if (!existing.responsible_user_id) {
        throw new ActionPlansValidationError([
          { path: "responsibleUserId", message: "A ação não possui respondente responsável." },
        ]);
      }
      try {
        assertProgressDoesNotDecrease(
          existing.progress_percentage,
          command.progressPercentage,
        );
      } catch (caught) {
        if (
          caught instanceof Error &&
          caught.message === PROGRESS_PERCENTAGE_CANNOT_DECREASE
        ) {
          throw new DomainConflictError(
            progressCannotDecreaseMessage(existing.progress_percentage),
          );
        }
        throw caught;
      }
      return {
        recommendationId: command.recommendationId,
        planId: command.planId,
        expectedRevision: command.expectedRevision,
        actionText: existing.action_text,
        startDate: String(existing.start_date).slice(0, 10),
        dueDate: String(existing.due_date).slice(0, 10),
        responsibleSector: sector || "Área responsável",
        responsibleUserId: existing.responsible_user_id,
        progressPercentage: command.progressPercentage,
        cancelled: false,
        observations: existing.execution_notes,
        progressUpdateDescription: command.progressUpdateDescription,
      };
    }

    if (command.intent === "edit_details") {
      const currentDueDate = String(existing.due_date).slice(0, 10);
      if (command.startDate > currentDueDate) {
        throw new ActionPlansValidationError([
          {
            path: "startDate",
            message: "O início não pode ser posterior ao final vigente.",
          },
        ]);
      }
      return {
        recommendationId: command.recommendationId,
        planId: command.planId,
        expectedRevision: command.expectedRevision,
        actionText: command.actionText,
        startDate: command.startDate,
        // O final vigente não é editável por este comando. Alterações passam
        // pelo fluxo formal de solicitação e decisão administrativa.
        dueDate: currentDueDate,
        responsibleSector: command.responsibleSector,
        responsibleUserId: command.responsibleUserId,
        progressPercentage: existing.progress_percentage,
        cancelled: existing.status === "cancelled",
        observations: existing.execution_notes,
        progressUpdateDescription: null,
      };
    }

    // cancel
    const { sector } = parseResponsibleLabel(String(existing.responsible_label ?? ""));
    if (!existing.responsible_user_id) {
      throw new ActionPlansValidationError([
        { path: "responsibleUserId", message: "A ação não possui respondente responsável." },
      ]);
    }
    return {
      recommendationId: command.recommendationId,
      planId: command.planId,
      expectedRevision: command.expectedRevision,
      actionText: existing.action_text,
      startDate: String(existing.start_date).slice(0, 10),
      dueDate: String(existing.due_date).slice(0, 10),
      responsibleSector: sector || "Área responsável",
      responsibleUserId: existing.responsible_user_id,
      progressPercentage: existing.progress_percentage,
      cancelled: true,
      observations: command.observations,
      progressUpdateDescription: null,
    };
  }

  private async loadPersistedAction(
    planId: string,
    recommendationId: string,
  ): Promise<PersistedActionRow> {
    const { data, error } = await this.supabase
      .from("action_plans")
      .select(
        "id, recommendation_id, action_text, start_date, due_date, responsible_user_id, responsible_label, progress_percentage, status, execution_notes, revision",
      )
      .eq("id", planId)
      .eq("recommendation_id", recommendationId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new ActionPlansNotFoundError("Plano não encontrado.");
    }
    return data as PersistedActionRow;
  }

  private async persistRpc(
    payload: RpcSavePayload,
    caller: RespondentActionPlanCaller,
  ): Promise<{ planId: string; mode: "created" | "updated"; revision: number }> {
    const scope = await loadRecommendationScope(this.supabase, payload.recommendationId);

    if (!scope || scope.organizationId !== caller.organizationId) {
      throw new ActionPlansNotFoundError("Recomendação não encontrada.");
    }

    if (!isActionPlanEligible(scope.cycleState as Parameters<typeof isActionPlanEligible>[0])) {
      const current = cycleStateLabelOrFallback(scope.cycleState);
      const eligibleStates = ACTION_PLAN_ELIGIBLE_STATES
        .map((state) => cycleStateLabelOrFallback(state))
        .join(" ou ");
      throw new DomainConflictError(
        `O plano de integridade e compliance só pode ser preenchido quando o diagnóstico estiver em ${eligibleStates} (estado atual: ${current}).`,
      );
    }

    if (!scope.axisId) {
      throw new ActionPlansValidationError([
        { path: "_", message: RESPONDENT_AXIS_UNRESOLVED_MESSAGE },
      ]);
    }

    const { data, error } = await this.supabase.rpc("save_respondent_action_plan", {
      p_actor_user_id: caller.userId,
      p_organization_id: caller.organizationId,
      p_plan_id: payload.planId,
      p_recommendation_id: payload.recommendationId,
      p_action_text: payload.actionText,
      p_due_date: payload.dueDate,
      p_start_date: payload.startDate,
      p_responsible_sector: payload.responsibleSector,
      p_responsible_user_id: payload.responsibleUserId,
      p_progress_percentage: payload.progressPercentage,
      p_cancelled: payload.cancelled,
      p_expected_revision: payload.expectedRevision ?? undefined,
      p_execution_notes: payload.observations,
      p_progress_update_description: payload.progressUpdateDescription,
    });

    if (error) {
      this.throwMappedRpcError(error);
    }

    const row = (Array.isArray(data) ? data[0] : data) as SaveResult | null;
    if (!row?.plan_id || !row.mode || !Number.isInteger(row.revision)) {
      throw new Error("A operação não retornou o plano de integridade e compliance persistido.");
    }

    logInfo(`action_plans.respondent.${row.mode}`, {
      actorUserId: caller.userId,
      organizationId: caller.organizationId,
      recommendationId: payload.recommendationId,
      planId: row.plan_id,
    });

    return { planId: row.plan_id, mode: row.mode, revision: row.revision };
  }

  private throwMappedRpcError(error: { message?: string; details?: string }): never {
    const message = `${error.message ?? ""} ${error.details ?? ""}`;
    if (hasDatabaseErrorCode(message, "action_plan_progress_cannot_decrease")) {
      throw new DomainConflictError(
        "O progresso da ação não pode ser reduzido. Informe um percentual igual ou superior ao já registrado.",
      );
    }
    if (hasDatabaseErrorCode(message, "action_plan_revision_conflict")) {
      throw new DomainConflictError(
        "Esta ação foi alterada em outra aba ou por outro usuário. Recarregue o plano antes de salvar novamente.",
      );
    }
    if (hasDatabaseErrorCode(message, "action_plan_not_found")) {
      throw new ActionPlansNotFoundError("Plano não encontrado.");
    }
    if (hasDatabaseErrorCode(message, "action_plan_cycle_not_editable")) {
      throw new DomainConflictError(
        "O diagnóstico não está disponível para edição do plano de integridade e compliance.",
      );
    }
    if (hasDatabaseErrorCode(message, "action_plan_cancel_has_open_supervision_request")) {
      throw new DomainConflictError(
        "Resolva ou cancele as solicitações de supervisão abertas antes de cancelar esta ação.",
      );
    }
    if (hasDatabaseErrorCode(message, "action_plan_has_execution_documents")) {
      throw new DomainConflictError(
        "Esta ação possui comprovações e não pode ser excluída. Cancele a ação para preservar a rastreabilidade.",
      );
    }
    if (hasDatabaseErrorCode(message, "action_plan_exception_active")) {
      throw new DomainConflictError(
        "Não é possível cadastrar ou alterar ações enquanto houver uma solicitação de exceção pendente ou aprovada.",
      );
    }
    if (hasDatabaseErrorCode(message, "action_plan_deadline_change_requests_action_plan_id_fkey")) {
      throw new DomainConflictError(
        "Esta ação possui histórico de solicitação de alteração de prazo e não pode ser excluída. Cancele a ação para preservar a rastreabilidade.",
      );
    }
    if (hasDatabaseErrorCode(message, "action_plan_supervision_notes_action_plan_id_fkey")) {
      throw new DomainConflictError(
        "Esta ação possui histórico de supervisão e não pode ser excluída. Cancele a ação para preservar a rastreabilidade.",
      );
    }
    if (isForeignKeyViolation(error)) {
      throw new DomainConflictError(
        "Esta ação possui histórico relacionado e não pode ser excluída. Cancele a ação para preservar a rastreabilidade.",
      );
    }
    if (hasDatabaseErrorCode(message, "action_plan_start_after_due")) {
      throw new ActionPlansValidationError([
        {
          path: "startDate",
          message: "O início não pode ser posterior ao final.",
        },
      ]);
    }
    if (hasDatabaseErrorCode(message, "action_plan_invalid_start_date")) {
      throw new ActionPlansValidationError([
        { path: "startDate", message: "Informe um início válido." },
      ]);
    }
    if (hasDatabaseErrorCode(message, "action_plan_responsible_user_required") ||
        hasDatabaseErrorCode(message, "action_plan_responsible_user_not_in_organization")) {
      throw new ActionPlansValidationError([
        { path: "responsibleUserId", message: "Selecione um respondente válido da organização." },
      ]);
    }
    if (hasDatabaseErrorCode(message, "action_plan_actor_not_authorized")) {
      throw new ActionPlansNotFoundError();
    }
    throw error;
  }
}
