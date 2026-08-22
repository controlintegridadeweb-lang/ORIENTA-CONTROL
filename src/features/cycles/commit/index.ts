import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DomainConflictError } from "@/infrastructure/api/domain-errors";
import type { CycleState } from "@/shared/domain/types";

/**
 * Commit transacional das transições que não materializam o diagnóstico.
 *
 * O FAMI, a política e os snapshots são congelados exclusivamente por
 * `finalize_validation_cycle`, na conclusão da validação. Esta função atende
 * envio/reenvio e demais transições que utilizam `commit_cycle_transition`.
 */
export type CommitCycleResult = {
  fromState: string;
  toState: string;
  processingId: string | null;
  closed: boolean;
};

export async function commitCycleTransition(
  supabase: SupabaseClient,
  params: {
    cycleId: string;
    actorUserId: string;
    toState: CycleState | null;
    expectedFromState?: CycleState | null;
  },
): Promise<CommitCycleResult> {
  const { data, error } = await supabase.rpc("commit_cycle_transition", {
    p_cycle_id: params.cycleId,
    p_actor_user_id: params.actorUserId,
    p_to_state: params.toState,
    p_fami_rows: null,
    p_snapshot_payload: null,
    p_expected_from_state: params.expectedFromState ?? null,
  });

  if (error) {
    const message = (error as { message?: string }).message ?? "";
    if (hasDatabaseErrorCode(message, "cycle_state_conflict")) {
      throw new DomainConflictError(
        "O diagnóstico mudou de estado durante a operação. Atualize a página e tente novamente.",
      );
    }
    if (hasDatabaseErrorCode(message, "submission_not_ready")) {
      throw new DomainConflictError(
        "Respostas ou correções foram alteradas durante o envio. Revise as pendências e tente novamente.",
      );
    }
    if (hasDatabaseErrorCode(message, "fami_materialization_only_at_validation")) {
      throw new DomainConflictError(
        "O FAMI só pode ser materializado ao concluir a validação do diagnóstico.",
      );
    }
    if (hasDatabaseErrorCode(message, "cycle_close_requires_finalized_diagnosis")) {
      throw new DomainConflictError(
        "Conclua a validação e calcule o FAMI antes de encerrar a avaliação.",
      );
    }
    if (hasDatabaseErrorCode(message, "close_requires_completed_and_approved_action_plans")) {
      throw new DomainConflictError(
        "Conclua as ações, resolva as solicitações abertas e registre o aceite da supervisão antes de encerrar a avaliação.",
      );
    }
    throw error;
  }

  const result = (data ?? {}) as Record<string, unknown>;
  return {
    fromState: String(result.fromState ?? ""),
    toState: String(result.toState ?? ""),
    processingId: result.processingId == null ? null : String(result.processingId),
    closed: Boolean(result.closed),
  };
}
