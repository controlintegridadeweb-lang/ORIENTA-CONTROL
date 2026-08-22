import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainConflictError } from "@/infrastructure/api/domain-errors";
import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import { logError } from "@/infrastructure/observability/logger";
import {
  createSupabaseServiceRoleClient,
  type TypedSupabaseClient,
} from "@/infrastructure/supabase/server";
import { describeAllowedEvidenceFile } from "@/features/evidences";
import { verifyStoredEvidenceFile } from "@/features/evidences/server";
import { isActionPlanEligible } from "@/shared/domain/workflow";
import type { ActionPlanDocument } from "./domain-model";
import { loadRecommendationScope } from "./cycle-read-model";
import { ActionPlansNotFoundError, ActionPlansValidationError } from "./access";

export const ACTION_PLAN_DOCUMENT_BUCKET = "planos-acao";
const PENDING_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;

const documentRowSchema = z.object({
  id: z.string().uuid(),
  action_plan_id: z.string().uuid(),
  action_revision: z.coerce.number().int().positive(),
  kind: z.enum(["file", "link"]),
  title: z.string(),
  storage_path: z.string().nullable(),
  external_link: z.string().nullable(),
  original_filename: z.string().nullable(),
  mime_type: z.string().nullable(),
  size_bytes: z.coerce.number().int().nonnegative().nullable(),
  file_validation_status: z.enum(["not_applicable", "valid", "rejected", "removed"]),
  validated_at: z.string().nullable().optional().default(null),
  created_at: z.string(),
});

const pendingUploadRowSchema = z.object({
  id: z.string().uuid(),
  action_plan_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  action_revision: z.coerce.number().int().positive(),
  title: z.string(),
  storage_path: z.string().min(1),
  original_filename: z.string().min(1),
  mime_type: z.string().nullable(),
  size_bytes: z.coerce.number().int().positive(),
  uploaded_by: z.string().uuid(),
  expires_at: z.string(),
});

type RespondentCaller = {
  userId: string;
  organizationId: string;
};

type PlanScope = {
  planId: string;
  revision: number;
  recommendationId: string;
  organizationId: string;
};

export type ActionPlanDocumentUploadInitialization = {
  pendingUploadId: string;
  storagePath: string;
  bucket: typeof ACTION_PLAN_DOCUMENT_BUCKET;
  expiresAt: string;
  uploadToken: string;
};

function safeFilename(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return normalized.slice(-180) || "comprovacao";
}

function toDocument(row: z.infer<typeof documentRowSchema>): ActionPlanDocument {
  return {
    id: row.id,
    actionRevision: row.action_revision,
    kind: row.kind,
    title: row.title,
    externalLink: row.external_link,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    fileValidationStatus: row.file_validation_status,
    validatedAt: row.validated_at,
    createdAt: row.created_at,
    isCurrentRevision: true,
  };
}

function errorMessage(error: unknown): string {
  return error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";
}

function throwDocumentWriteError(error: unknown): never {
  const message = errorMessage(error);
  if (
    hasDatabaseErrorCode(message, "action_plan_document_revision_conflict") ||
    hasDatabaseErrorCode(message, "pending_action_plan_document_revision_conflict")
  ) {
    throw new DomainConflictError(
      "A ação foi alterada. Recarregue os dados antes de modificar as comprovações.",
    );
  }
  if (
    hasDatabaseErrorCode(message, "action_plan_document_cycle_not_editable") ||
    hasDatabaseErrorCode(message, "pending_action_plan_document_cycle_not_editable")
  ) {
    throw new DomainConflictError(
      "Comprovações só podem ser alteradas enquanto o plano de ação estiver em execução.",
    );
  }
  if (
    hasDatabaseErrorCode(message, "action_plan_document_action_cancelled") ||
    hasDatabaseErrorCode(message, "pending_action_plan_document_action_cancelled")
  ) {
    throw new DomainConflictError(
      "Não é possível adicionar comprovações a uma ação cancelada.",
    );
  }
  if (hasDatabaseErrorCode(message, "action_plan_document_approval_effective")) {
    throw new DomainConflictError(
      "O conjunto aprovado é imutável. Atualize primeiro a ação para criar uma nova revisão antes de alterar as comprovações.",
    );
  }
  if (
    hasDatabaseErrorCode(message, "action_plan_document_action_not_found") ||
    hasDatabaseErrorCode(message, "action_plan_document_not_found") ||
    hasDatabaseErrorCode(message, "action_plan_document_actor_not_authorized") ||
    hasDatabaseErrorCode(message, "pending_action_plan_document_action_not_found") ||
    hasDatabaseErrorCode(message, "pending_action_plan_document_not_found") ||
    hasDatabaseErrorCode(message, "pending_action_plan_document_expired")
  ) {
    throw new ActionPlansNotFoundError("Upload temporário, comprovação ou ação não encontrado.");
  }
  if (
    hasDatabaseErrorCode(message, "pending_action_plan_document_invalid_metadata") ||
    hasDatabaseErrorCode(message, "action_plan_document_verified_mime_required") ||
    hasDatabaseErrorCode(message, "action_plan_document_invalid_deactivation_reason")
  ) {
    throw new ActionPlansValidationError([
      { path: "file", message: "Os dados da comprovação são inválidos." },
    ]);
  }
  throw error;
}

function isTransientStorageVerificationError(error: unknown): boolean {
  const message = errorMessage(error);
  return (
    message.startsWith("storage_signature_fetch_failed:") ||
    message === "storage_signature_body_missing"
  );
}

export class ActionPlanDocumentService {
  private readonly supabase: TypedSupabaseClient;

  constructor(client?: TypedSupabaseClient) {
    this.supabase = client ?? createSupabaseServiceRoleClient();
  }

  private async requirePlan(
    planId: string,
    expectedRevision: number,
    caller: RespondentCaller,
  ): Promise<PlanScope> {
    const { data, error } = await this.supabase
      .from("action_plans")
      .select("id,revision,recommendation_id,status")
      .eq("id", planId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ActionPlansNotFoundError("Ação não encontrada.");
    if (Number(data.revision) !== expectedRevision) {
      throw new DomainConflictError(
        "A ação foi alterada. Recarregue os dados antes de anexar a comprovação.",
      );
    }
    if (data.status === "cancelled") {
      throw new DomainConflictError(
        "Não é possível adicionar comprovações a uma ação cancelada.",
      );
    }

    const scope = await loadRecommendationScope(
      this.supabase,
      String(data.recommendation_id),
    );
    if (!scope || scope.organizationId !== caller.organizationId) {
      throw new ActionPlansNotFoundError("Ação não encontrada.");
    }
    if (!isActionPlanEligible(scope.cycleState as Parameters<typeof isActionPlanEligible>[0])) {
      throw new DomainConflictError(
        "Comprovações só podem ser alteradas enquanto o plano de ação estiver em execução.",
      );
    }

    const { data: approval, error: approvalError } = await this.supabase
      .from("action_plan_supervision_notes")
      .select("id")
      .eq("action_plan_id", planId)
      .eq("action_revision", expectedRevision)
      .eq("note_type", "approval")
      .eq("lifecycle_status", "effective")
      .limit(1)
      .maybeSingle();
    if (approvalError) throw approvalError;
    if (approval) {
      throw new DomainConflictError(
        "O conjunto aprovado é imutável. Atualize primeiro a ação para criar uma nova revisão antes de alterar as comprovações.",
      );
    }

    return {
      planId: String(data.id),
      revision: Number(data.revision),
      recommendationId: String(data.recommendation_id),
      organizationId: scope.organizationId,
    };
  }

  async addLink(input: {
    planId: string;
    expectedRevision: number;
    title: string;
    externalLink: string;
  }, caller: RespondentCaller): Promise<ActionPlanDocument> {
    const title = input.title.trim();
    if (title.length < 3 || title.length > 200) {
      throw new ActionPlansValidationError([
        { path: "title", message: "Informe um título entre 3 e 200 caracteres." },
      ]);
    }
    let url: URL;
    try {
      url = new URL(input.externalLink.trim());
    } catch {
      throw new ActionPlansValidationError([
        { path: "externalLink", message: "Informe um endereço HTTPS válido." },
      ]);
    }
    if (url.protocol !== "https:") {
      throw new ActionPlansValidationError([
        { path: "externalLink", message: "A comprovação externa deve usar HTTPS." },
      ]);
    }

    const plan = await this.requirePlan(input.planId, input.expectedRevision, caller);
    const { data, error } = await this.supabase
      .from("action_plan_documents")
      .insert({
        action_plan_id: plan.planId,
        organization_id: plan.organizationId,
        action_revision: plan.revision,
        kind: "link",
        title,
        external_link: url.toString(),
        file_validation_status: "not_applicable",
        uploaded_by: caller.userId,
      })
      .select("id,action_plan_id,action_revision,kind,title,storage_path,external_link,original_filename,mime_type,size_bytes,file_validation_status,validated_at,created_at")
      .single();
    if (error) throwDocumentWriteError(error);
    return toDocument(documentRowSchema.parse(data));
  }

  async initializeFile(input: {
    planId: string;
    expectedRevision: number;
    title: string;
    filename: string;
    mimeType: string | null;
    sizeBytes: number;
  }, caller: RespondentCaller): Promise<ActionPlanDocumentUploadInitialization> {
    const title = input.title.trim();
    if (title.length < 3 || title.length > 200) {
      throw new ActionPlansValidationError([
        { path: "title", message: "Informe um título entre 3 e 200 caracteres." },
      ]);
    }

    let descriptor;
    try {
      descriptor = describeAllowedEvidenceFile({
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      });
    } catch (error) {
      throw new ActionPlansValidationError([
        { path: "file", message: error instanceof Error ? error.message : "Arquivo inválido." },
      ]);
    }

    const plan = await this.requirePlan(input.planId, input.expectedRevision, caller);
    const pendingUploadId = randomUUID();
    const storagePath = `${plan.organizationId}/${plan.planId}/${pendingUploadId}-${safeFilename(input.filename)}`;
    const expiresAt = new Date(Date.now() + PENDING_UPLOAD_TTL_MS).toISOString();

    const { error: initializeError } = await this.supabase.rpc(
      "initialize_action_plan_document_upload",
      {
        p_actor_user_id: caller.userId,
        p_organization_id: plan.organizationId,
        p_plan_id: plan.planId,
        p_pending_upload_id: pendingUploadId,
        p_expected_revision: plan.revision,
        p_title: title,
        p_storage_path: storagePath,
        p_original_filename: input.filename,
        p_mime_type: descriptor.declaredMimeType || descriptor.canonicalMimeType,
        p_size_bytes: input.sizeBytes,
        p_expires_at: expiresAt,
      },
    );
    if (initializeError) throwDocumentWriteError(initializeError);

    const { data: signed, error: signedError } = await this.supabase.storage
      .from(ACTION_PLAN_DOCUMENT_BUCKET)
      .createSignedUploadUrl(storagePath);
    if (signedError || !signed?.token) {
      await this.discardPendingFile({ planId: plan.planId, pendingUploadId }, caller)
        .catch(() => undefined);
      throw signedError ?? new Error("signed_upload_token_missing");
    }

    return {
      pendingUploadId,
      storagePath,
      bucket: ACTION_PLAN_DOCUMENT_BUCKET,
      expiresAt,
      uploadToken: signed.token,
    };
  }

  async confirmFile(input: {
    planId: string;
    pendingUploadId: string;
    expectedRevision: number;
  }, caller: RespondentCaller): Promise<ActionPlanDocument> {
    const { data: existingDocument, error: existingDocumentError } = await this.supabase
      .from("action_plan_documents")
      .select("id,action_plan_id,action_revision,kind,title,storage_path,external_link,original_filename,mime_type,size_bytes,file_validation_status,validated_at,created_at")
      .eq("id", input.pendingUploadId)
      .eq("action_plan_id", input.planId)
      .eq("organization_id", caller.organizationId)
      .eq("uploaded_by", caller.userId)
      .eq("action_revision", input.expectedRevision)
      .is("deactivated_at", null)
      .maybeSingle();
    if (existingDocumentError) throw existingDocumentError;
    if (existingDocument) {
      return toDocument(documentRowSchema.parse(existingDocument));
    }

    const plan = await this.requirePlan(input.planId, input.expectedRevision, caller);
    const { data, error } = await this.supabase
      .from("pending_action_plan_document_uploads")
      .select("id,action_plan_id,organization_id,action_revision,title,storage_path,original_filename,mime_type,size_bytes,uploaded_by,expires_at")
      .eq("id", input.pendingUploadId)
      .eq("action_plan_id", plan.planId)
      .eq("organization_id", caller.organizationId)
      .eq("uploaded_by", caller.userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ActionPlansNotFoundError("Upload temporário não encontrado.");

    const pending = pendingUploadRowSchema.parse(data);
    if (new Date(pending.expires_at).getTime() <= Date.now()) {
      await this.discardPendingFile(
        { planId: plan.planId, pendingUploadId: pending.id },
        caller,
      ).catch(() => undefined);
      throw new ActionPlansNotFoundError("Upload temporário expirado.");
    }

    const descriptor = describeAllowedEvidenceFile({
      filename: pending.original_filename,
      mimeType: pending.mime_type,
      sizeBytes: pending.size_bytes,
    });
    const { data: signedDownload, error: signedDownloadError } = await this.supabase.storage
      .from(ACTION_PLAN_DOCUMENT_BUCKET)
      .createSignedUrl(pending.storage_path, 120, { download: true });
    if (signedDownloadError || !signedDownload?.signedUrl) {
      throw signedDownloadError ?? new Error("signed_download_url_missing");
    }

    let verifiedMimeType: string;
    try {
      verifiedMimeType = await verifyStoredEvidenceFile({
        signedUrl: signedDownload.signedUrl,
        descriptor,
        expectedSizeBytes: pending.size_bytes,
      });
    } catch (error) {
      if (isTransientStorageVerificationError(error)) throw error;
      await this.discardPendingFile(
        { planId: plan.planId, pendingUploadId: pending.id },
        caller,
      ).catch(() => undefined);
      throw new ActionPlansValidationError([
        { path: "file", message: error instanceof Error ? error.message : "Arquivo inválido." },
      ]);
    }

    const { data: committed, error: commitError } = await this.supabase.rpc(
      "commit_action_plan_document_upload",
      {
        p_actor_user_id: caller.userId,
        p_organization_id: caller.organizationId,
        p_plan_id: plan.planId,
        p_pending_upload_id: pending.id,
        p_expected_revision: input.expectedRevision,
        p_verified_mime_type: verifiedMimeType,
      },
    );
    if (commitError) throwDocumentWriteError(commitError);
    const row = Array.isArray(committed) ? committed[0] : committed;
    if (!row) throw new Error("action_plan_document_commit_missing_result");
    return toDocument(documentRowSchema.parse(row));
  }

  async discardPendingFile(input: {
    planId: string;
    pendingUploadId: string;
  }, caller: RespondentCaller): Promise<{ ok: true; cleanupPending: boolean }> {
    const { data, error } = await this.supabase.rpc(
      "discard_pending_action_plan_document_upload",
      {
        p_pending_upload_id: input.pendingUploadId,
        p_plan_id: input.planId,
        p_organization_id: caller.organizationId,
        p_actor_user_id: caller.userId,
      },
    );
    if (error) {
      if (hasDatabaseErrorCode(error.message, "pending_action_plan_document_not_found")) {
        return { ok: true, cleanupPending: false };
      }
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const storagePath = row?.storage_path ? String(row.storage_path) : null;
    if (!storagePath) return { ok: true, cleanupPending: false };

    const { error: storageError } = await this.supabase.storage
      .from(ACTION_PLAN_DOCUMENT_BUCKET)
      .remove([storagePath]);
    const alreadyMissing = Boolean(
      storageError && /not found|does not exist|404/i.test(storageError.message),
    );
    if (storageError && !alreadyMissing) {
      logError("Failed to remove discarded pending action plan document", storageError, {
        pendingUploadId: input.pendingUploadId,
        storagePath,
      });
      return { ok: true, cleanupPending: true };
    }

    const { error: acknowledgeError } = await this.supabase
      .from("action_plan_storage_cleanup_queue")
      .delete()
      .eq("storage_path", storagePath);
    if (acknowledgeError) {
      logError("Failed to acknowledge discarded action plan upload cleanup", acknowledgeError, {
        pendingUploadId: input.pendingUploadId,
        storagePath,
      });
    }
    return { ok: true, cleanupPending: Boolean(acknowledgeError) };
  }

  async deactivate(input: {
    planId: string;
    documentId: string;
    expectedRevision: number;
    reason: string;
  }, caller: RespondentCaller): Promise<void> {
    const reason = input.reason.trim();
    if (reason.length < 5 || reason.length > 1000) {
      throw new ActionPlansValidationError([
        { path: "reason", message: "Informe o motivo da remoção com pelo menos 5 caracteres." },
      ]);
    }
    const { data, error } = await this.supabase.rpc("deactivate_action_plan_document", {
      p_actor_user_id: caller.userId,
      p_organization_id: caller.organizationId,
      p_plan_id: input.planId,
      p_document_id: input.documentId,
      p_expected_revision: input.expectedRevision,
      p_reason: reason,
    });
    if (error) throwDocumentWriteError(error);

    const row = Array.isArray(data) ? data[0] : data;
    const storagePath = row?.storage_path ?? null;
    if (storagePath) {
      const { error: storageError } = await this.supabase.storage
        .from(ACTION_PLAN_DOCUMENT_BUCKET)
        .remove([String(storagePath)]);
      const alreadyMissing = Boolean(
        storageError && /not found|does not exist|404/i.test(storageError.message),
      );
      if (storageError && !alreadyMissing) {
        logError("Failed to remove deactivated action plan document", storageError, {
          documentId: input.documentId,
          storagePath,
        });
        return;
      }

      const { error: acknowledgeError } = await this.supabase
        .from("action_plan_storage_cleanup_queue")
        .delete()
        .eq("storage_path", storagePath);
      if (acknowledgeError) {
        logError("Failed to acknowledge action plan document cleanup", acknowledgeError, {
          documentId: input.documentId,
          storagePath,
        });
      }
    }
  }
}

