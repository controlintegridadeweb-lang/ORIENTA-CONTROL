import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";
import { buildEvidenceStoragePath } from "./storage-path";
import { logError } from "@/infrastructure/observability/logger";

export const EVIDENCE_BUCKET = "evidencias";
const PENDING_EVIDENCE_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

const pendingUploadRowSchema = z.object({
  id: z.string().uuid(),
  cycle_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  uploaded_by: z.string().uuid(),
  storage_path: z.string().min(1),
  original_filename: z.string().min(1),
  mime_type: z.string().nullable(),
  verified_mime_type: z.string().nullable(),
  verified_at: z.string().nullable(),
  file_validation_status: z.enum(["upload_started", "validating", "valid", "rejected", "removed"]),
  size_bytes: z.number().int().nonnegative(),
  expires_at: z.string(),
});

export type PendingEvidenceUpload = {
  id: string;
  storagePath: string;
  expiresAt: string;
};

type CreatePendingEvidenceUploadInput = {
  organizationId: string;
  cycleId: string;
  uploadedBy: string;
  originalFilename: string;
  safeFilename: string;
  mimeType: string | null;
  sizeBytes: number;
};

/**
 * Cria o registro temporário antes do upload físico. Enquanto ele existir, o
 * arquivo não pode ser associado a uma evidência por outro usuário ou ciclo.
 */
export async function createPendingEvidenceUpload(
  supabase: TypedSupabaseClient,
  input: CreatePendingEvidenceUploadInput,
): Promise<PendingEvidenceUpload> {
  const id = randomUUID();
  const storagePath = buildEvidenceStoragePath(
    input.organizationId,
    input.cycleId,
    id,
    input.safeFilename,
  );
  const expiresAt = new Date(Date.now() + PENDING_EVIDENCE_UPLOAD_TTL_MS).toISOString();

  const { error } = await supabase.from("pending_evidence_uploads").insert({
    id,
    cycle_id: input.cycleId,
    organization_id: input.organizationId,
    uploaded_by: input.uploadedBy,
    storage_path: storagePath,
    original_filename: input.originalFilename,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    expires_at: expiresAt,
  });
  if (error) throw error;

  return { id, storagePath, expiresAt };
}


export async function markPendingEvidenceUploadVerified(
  supabase: TypedSupabaseClient,
  input: {
    pendingUploadId: string;
    cycleId: string;
    organizationId: string;
    uploadedBy: string;
    verifiedMimeType: string;
  },
): Promise<PendingEvidenceUpload> {
  const verifiedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("pending_evidence_uploads")
    .update({
      verified_mime_type: input.verifiedMimeType,
      verified_at: verifiedAt,
      file_validation_status: "valid",
    })
    .eq("id", input.pendingUploadId)
    .eq("cycle_id", input.cycleId)
    .eq("organization_id", input.organizationId)
    .eq("uploaded_by", input.uploadedBy)
    .gt("expires_at", verifiedAt)
    .select("id,storage_path,expires_at")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Upload temporário não encontrado, expirado ou fora do escopo autorizado.");
  return { id: data.id, storagePath: data.storage_path, expiresAt: data.expires_at };
}

/** Remove o registro temporário após falha de upload. O arquivo ainda não foi
 * vinculado a uma evidência; a limpeza posterior cobre falhas eventuais. */

type DiscardPendingEvidenceUploadInput = {
  pendingUploadId: string;
  cycleId: string;
  organizationId: string;
  uploadedBy: string;
};

/**
 * Descarta um arquivo ainda não associado a uma evidência. A linha deixa de
 * ser associável e a exclusão física fica registrada atomicamente na fila;
 * assim uma falha transitória continua recuperável pela rotina programada.
 */
export async function discardPendingEvidenceUpload(
  supabase: TypedSupabaseClient,
  input: DiscardPendingEvidenceUploadInput,
): Promise<
  | { ok: true; cleanupPending: boolean }
  | { ok: false; status: number; error: string }
> {
  const { data, error } = await supabase
    .from("pending_evidence_uploads")
    .select("id, cycle_id, organization_id, uploaded_by, storage_path, original_filename, mime_type, verified_mime_type, verified_at, file_validation_status, size_bytes, expires_at")
    .eq("id", input.pendingUploadId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return { ok: false, status: 404, error: "Upload temporário não encontrado ou já foi associado." };
  }

  const row = pendingUploadRowSchema.parse(data);
  if (
    row.cycle_id !== input.cycleId ||
    row.organization_id !== input.organizationId ||
    row.uploaded_by !== input.uploadedBy
  ) {
    return { ok: false, status: 403, error: "Upload temporário fora do escopo autorizado." };
  }

  const { data: discarded, error: discardError } = await supabase.rpc(
    "discard_pending_evidence_upload",
    {
      p_pending_upload_id: row.id,
      p_cycle_id: input.cycleId,
      p_organization_id: input.organizationId,
      p_actor_user_id: input.uploadedBy,
    },
  );
  if (discardError) {
    const message = discardError.message ?? "";
    if (hasDatabaseErrorCode(message, "pending_evidence_upload_not_found")) {
      return { ok: false, status: 404, error: "Upload temporário não encontrado ou já foi associado." };
    }
    if (hasDatabaseErrorCode(message, "pending_evidence_upload_scope_mismatch")) {
      return { ok: false, status: 403, error: "Upload temporário fora do escopo autorizado." };
    }
    throw discardError;
  }

  const storagePath =
    discarded &&
    typeof discarded === "object" &&
    !Array.isArray(discarded) &&
    typeof discarded.storagePath === "string"
      ? discarded.storagePath
      : row.storage_path;
  const { error: storageError } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .remove([storagePath]);
  if (storageError && !/not found|does not exist|404/i.test(storageError.message)) {
    logError("Failed to remove discarded pending evidence object", storageError, {
      pendingUploadId: row.id,
      storagePath,
    });
    return { ok: true, cleanupPending: true };
  }

  const { error: acknowledgeError } = await supabase
    .from("evidence_storage_cleanup_queue")
    .delete()
    .eq("storage_path", storagePath);
  if (acknowledgeError) {
    logError("Failed to acknowledge discarded pending evidence cleanup", acknowledgeError, {
      pendingUploadId: row.id,
      storagePath,
    });
  }

  return { ok: true, cleanupPending: Boolean(acknowledgeError) };
}

const expiredPendingUploadSchema = pendingUploadRowSchema;

/**
 * Limpa uploads que nunca foram associados a uma evidência. A rotina é
 * idempotente: se o objeto já não existir, o registro ainda é descartado.
 */
export async function cleanupExpiredPendingEvidenceUploads(
  supabase: TypedSupabaseClient,
  options?: { batchSize?: number; now?: Date },
): Promise<{ inspected: number; removed: number; failed: number }> {
  const batchSize = Math.min(Math.max(options?.batchSize ?? 100, 1), 500);
  const now = (options?.now ?? new Date()).toISOString();
  const { data, error } = await supabase
    .from("pending_evidence_uploads")
    .select("id, cycle_id, organization_id, uploaded_by, storage_path, original_filename, mime_type, verified_mime_type, verified_at, file_validation_status, size_bytes, expires_at")
    .lte("expires_at", now)
    .order("expires_at", { ascending: true })
    .limit(batchSize);
  if (error) throw error;

  let removed = 0;
  let failed = 0;
  const rows = z.array(expiredPendingUploadSchema).parse(data ?? []);
  for (const row of rows) {
    const { error: discardError } = await supabase.rpc(
      "discard_pending_evidence_upload",
      {
        p_pending_upload_id: row.id,
        p_cycle_id: row.cycle_id,
        p_organization_id: row.organization_id,
        p_actor_user_id: row.uploaded_by,
      },
    );
    if (discardError) {
      // Outro worker pode ter consumido ou descartado a linha após a leitura.
      // Nesse caso não tocamos no Storage: o novo proprietário ou a fila já
      // assumiu a responsabilidade pelo objeto.
      if (hasDatabaseErrorCode(discardError, "pending_evidence_upload_not_found")) {
        removed += 1;
        continue;
      }
      failed += 1;
      logError("Failed to atomically discard expired evidence upload", discardError, {
        pendingUploadId: row.id,
        storagePath: row.storage_path,
      });
      continue;
    }

    const { error: storageError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .remove([row.storage_path]);

    // A fila transacional permanece quando a exclusão física falha, permitindo
    // que a rotina de limpeza retome o trabalho sem tornar o upload associável.
    const objectAlreadyMissing = Boolean(storageError && /not found|does not exist|404/i.test(storageError.message));
    if (storageError && !objectAlreadyMissing) {
      failed += 1;
      logError("Failed to clean expired pending evidence upload", storageError, {
        pendingUploadId: row.id,
        storagePath: row.storage_path,
      });
      continue;
    }

    const { error: acknowledgeError } = await supabase
      .from("evidence_storage_cleanup_queue")
      .delete()
      .eq("storage_path", row.storage_path);
    if (acknowledgeError) {
      failed += 1;
      logError("Failed to acknowledge expired evidence cleanup", acknowledgeError, {
        pendingUploadId: row.id,
        storagePath: row.storage_path,
      });
      continue;
    }
    removed += 1;
  }

  return { inspected: rows.length, removed, failed };
}

/**
 * Processa a outbox transacional de exclusões do Storage. Falhas recebem
 * backoff exponencial (máximo de 24 h) e permanecem visíveis para nova rodada.
 */
export async function cleanupQueuedEvidenceStorageObjects(
  supabase: TypedSupabaseClient,
  options?: { batchSize?: number; now?: Date },
): Promise<{ inspected: number; removed: number; failed: number }> {
  const batchSize = Math.min(Math.max(options?.batchSize ?? 100, 1), 500);
  const nowDate = options?.now ?? new Date();
  const now = nowDate.toISOString();
  const { data, error } = await supabase
    .from("evidence_storage_cleanup_queue")
    .select("storage_path,attempts")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(batchSize);
  if (error) throw error;

  let removed = 0;
  let failed = 0;
  const rows = z.array(z.object({
    storage_path: z.string().min(1),
    attempts: z.number().int().nonnegative(),
  })).parse(data ?? []);

  for (const row of rows) {
    const { error: storageError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .remove([row.storage_path]);
    const alreadyMissing = Boolean(
      storageError && /not found|does not exist|404/i.test(storageError.message),
    );
    if (!storageError || alreadyMissing) {
      const { error: deleteError } = await supabase
        .from("evidence_storage_cleanup_queue")
        .delete()
        .eq("storage_path", row.storage_path);
      if (!deleteError) {
        removed += 1;
        continue;
      }
      failed += 1;
      logError("Failed to acknowledge evidence storage cleanup", deleteError, {
        storagePath: row.storage_path,
      });
      continue;
    }

    failed += 1;
    const attempts = row.attempts + 1;
    const delayMinutes = Math.min(2 ** Math.min(attempts, 10), 24 * 60);
    const { error: retryError } = await supabase
      .from("evidence_storage_cleanup_queue")
      .update({
        attempts,
        last_error: storageError.message.slice(0, 2_000),
        scheduled_for: new Date(nowDate.getTime() + delayMinutes * 60_000).toISOString(),
      })
      .eq("storage_path", row.storage_path);
    logError("Failed to clean queued evidence object", storageError, {
      storagePath: row.storage_path,
      attempts,
    });
    if (retryError) {
      logError("Failed to schedule evidence cleanup retry", retryError, {
        storagePath: row.storage_path,
      });
    }
  }

  return { inspected: rows.length, removed, failed };
}
