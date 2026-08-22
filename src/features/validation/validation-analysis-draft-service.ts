import type { SupabaseClient } from "@supabase/supabase-js";
import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import {
  DomainAccessError,
  DomainConflictError,
  DomainNotFoundError,
  DomainValidationError,
} from "@/infrastructure/api/domain-errors";
import { logError, logInfo } from "@/infrastructure/observability/logger";
import { cycleValidationStateError, rpcErrorMessage } from "@/features/cycles/server";
import {
  validationAnalysisDraftSchema,
  type ValidationAnalysisDraft,
  type ValidationDraftTargetKind,
} from "./validation-analysis-draft";

export type SaveValidationAnalysisDraftInput = {
  actorUserId: string;
  targetKind: ValidationDraftTargetKind;
  evidenceId?: string | null;
  responseId?: string | null;
  action?: string | null;
  justification?: string | null;
  notes?: string | null;
  expectedRevision?: number | null;
};

export async function saveValidationAnalysisDraft(
  supabase: SupabaseClient,
  cycleId: string,
  input: SaveValidationAnalysisDraftInput,
): Promise<ValidationAnalysisDraft> {
  const { data, error } = await supabase.rpc("save_validation_analysis_draft", {
    p_cycle_id: cycleId,
    p_actor_user_id: input.actorUserId,
    p_target_kind: input.targetKind,
    p_evidence_id: input.evidenceId ?? null,
    p_response_id: input.responseId ?? null,
    p_action: input.action ?? null,
    p_justification: input.justification ?? null,
    p_notes: input.notes ?? null,
    p_expected_revision: input.expectedRevision ?? null,
  });

  if (error) {
    const msg = rpcErrorMessage(error);
    if (hasDatabaseErrorCode(msg, "global_admin_required")) {
      throw new DomainAccessError(
        "Somente administradores globais podem salvar rascunhos de validação.",
      );
    }
    if (
      hasDatabaseErrorCode(msg, "validation_draft_conflict") ||
      hasDatabaseErrorCode(msg, "validation_draft_already_applied")
    ) {
      throw new DomainConflictError(
        "O rascunho foi alterado ou já foi aplicado. Recarregue a análise antes de continuar.",
      );
    }
    if (
      hasDatabaseErrorCode(msg, "evidence_not_found") ||
      hasDatabaseErrorCode(msg, "response_not_found")
    ) {
      throw new DomainNotFoundError("Item de validação não encontrado.");
    }
    if (
      hasDatabaseErrorCode(msg, "evidence_not_in_cycle") ||
      hasDatabaseErrorCode(msg, "response_not_in_cycle")
    ) {
      throw new DomainConflictError(
        "O item não pertence ao diagnóstico informado.",
      );
    }
    if (
      hasDatabaseErrorCode(msg, "validation_draft_action_invalid") ||
      hasDatabaseErrorCode(msg, "validation_draft_target_kind_invalid") ||
      hasDatabaseErrorCode(msg, "validation_draft_target_invalid") ||
      hasDatabaseErrorCode(msg, "validation_draft_justification_too_long") ||
      hasDatabaseErrorCode(msg, "validation_draft_notes_too_long")
    ) {
      throw new DomainValidationError([
        {
          path: "draft",
          message: "Os dados do rascunho são inválidos.",
        },
      ]);
    }
    const stateError = cycleValidationStateError(msg, {
      codes: ["cycle_not_in_validation", "cycle_not_found"],
      operationMessage:
        "O salvamento de rascunho só é possível com o diagnóstico em validação.",
    });
    if (stateError) throw stateError;
    logError("validation.analysis_draft_save_failed", {
      cycleId,
      targetKind: input.targetKind,
      message: msg,
    });
    throw error;
  }

  const parsed = validationAnalysisDraftSchema.parse(data);
  if (!parsed.unchanged) {
    logInfo("validation.analysis_draft_saved", {
      cycleId,
      targetKind: parsed.targetKind,
      revision: parsed.revision,
      evidenceId: parsed.evidenceId,
      responseId: parsed.responseId,
    });
  }
  return parsed;
}

export async function loadActiveValidationAnalysisDrafts(
  supabase: SupabaseClient,
  cycleId: string,
  options: {
    evidenceIds?: string[];
    responseIds?: string[];
  },
): Promise<ValidationAnalysisDraft[]> {
  const evidenceIds = options.evidenceIds ?? [];
  const responseIds = options.responseIds ?? [];
  if (evidenceIds.length === 0 && responseIds.length === 0) return [];

  let query = supabase
    .from("validation_analysis_drafts")
    .select(
      "id, cycle_id, target_kind, evidence_id, response_id, action, justification, notes, revision, updated_at, applied_at",
    )
    .eq("cycle_id", cycleId)
    .is("applied_at", null);

  if (evidenceIds.length > 0 && responseIds.length > 0) {
    query = query.or(
      `evidence_id.in.(${evidenceIds.join(",")}),response_id.in.(${responseIds.join(",")})`,
    );
  } else if (evidenceIds.length > 0) {
    query = query.in("evidence_id", evidenceIds);
  } else {
    query = query.in("response_id", responseIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) =>
    validationAnalysisDraftSchema.parse({
      id: row.id,
      cycleId: row.cycle_id,
      targetKind: row.target_kind,
      evidenceId: row.evidence_id,
      responseId: row.response_id,
      action: row.action,
      justification: row.justification,
      notes: row.notes,
      revision: row.revision,
      updatedAt: row.updated_at,
      appliedAt: row.applied_at,
    }),
  );
}
