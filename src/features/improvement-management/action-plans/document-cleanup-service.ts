import "server-only";

import { z } from "zod";
import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import { logError } from "@/infrastructure/observability/logger";
import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";
import { ACTION_PLAN_DOCUMENT_BUCKET } from "./document-service";

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

/** Limpa uploads diretos que expiraram antes da confirmação. */
export async function cleanupExpiredPendingActionPlanDocumentUploads(
  supabase: TypedSupabaseClient,
  options?: { batchSize?: number; now?: Date },
): Promise<{ inspected: number; removed: number; failed: number }> {
  const batchSize = Math.min(Math.max(options?.batchSize ?? 100, 1), 500);
  const now = (options?.now ?? new Date()).toISOString();
  const { data, error } = await supabase
    .from("pending_action_plan_document_uploads")
    .select("id,action_plan_id,organization_id,action_revision,title,storage_path,original_filename,mime_type,size_bytes,uploaded_by,expires_at")
    .lte("expires_at", now)
    .order("expires_at", { ascending: true })
    .limit(batchSize);
  if (error) throw error;

  const rows = z.array(pendingUploadRowSchema).parse(data ?? []);
  let removed = 0;
  let failed = 0;
  for (const row of rows) {
    const { data: discarded, error: discardError } = await supabase.rpc(
      "discard_pending_action_plan_document_upload",
      {
        p_pending_upload_id: row.id,
        p_plan_id: row.action_plan_id,
        p_organization_id: row.organization_id,
        p_actor_user_id: row.uploaded_by,
      },
    );
    if (discardError) {
      if (hasDatabaseErrorCode(discardError.message, "pending_action_plan_document_not_found")) {
        removed += 1;
        continue;
      }
      failed += 1;
      logError("Failed to atomically discard expired action plan upload", discardError, {
        pendingUploadId: row.id,
        storagePath: row.storage_path,
      });
      continue;
    }

    const discardedRow = Array.isArray(discarded) ? discarded[0] : discarded;
    const storagePath = discardedRow?.storage_path
      ? String(discardedRow.storage_path)
      : row.storage_path;
    const { error: storageError } = await supabase.storage
      .from(ACTION_PLAN_DOCUMENT_BUCKET)
      .remove([storagePath]);
    const alreadyMissing = Boolean(
      storageError && /not found|does not exist|404/i.test(storageError.message),
    );
    if (storageError && !alreadyMissing) {
      failed += 1;
      logError("Failed to clean expired action plan upload", storageError, {
        pendingUploadId: row.id,
        storagePath,
      });
      continue;
    }

    const { error: acknowledgeError } = await supabase
      .from("action_plan_storage_cleanup_queue")
      .delete()
      .eq("storage_path", storagePath);
    if (acknowledgeError) {
      failed += 1;
      logError("Failed to acknowledge expired action plan upload cleanup", acknowledgeError, {
        pendingUploadId: row.id,
        storagePath,
      });
      continue;
    }
    removed += 1;
  }

  return { inspected: rows.length, removed, failed };
}

/**
 * Processa a outbox de exclusão do bucket `planos-acao`. Falhas permanecem
 * registradas com backoff exponencial para uma próxima execução do cron.
 */
export async function cleanupQueuedActionPlanStorageObjects(
  supabase: TypedSupabaseClient,
  options?: { batchSize?: number; now?: Date },
): Promise<{ inspected: number; removed: number; failed: number }> {
  const batchSize = Math.min(Math.max(options?.batchSize ?? 100, 1), 500);
  const nowDate = options?.now ?? new Date();
  const now = nowDate.toISOString();
  const { data, error } = await supabase
    .from("action_plan_storage_cleanup_queue")
    .select("storage_path,attempts")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(batchSize);
  if (error) throw error;

  const rows = z.array(z.object({
    storage_path: z.string().min(1),
    attempts: z.coerce.number().int().nonnegative(),
  })).parse(data ?? []);
  let removed = 0;
  let failed = 0;

  for (const row of rows) {
    const [{ data: activeDocument, error: activeDocumentError }, { data: pendingUpload, error: pendingUploadError }] = await Promise.all([
      supabase
        .from("action_plan_documents")
        .select("id")
        .eq("storage_path", row.storage_path)
        .is("deactivated_at", null)
        .maybeSingle(),
      supabase
        .from("pending_action_plan_document_uploads")
        .select("id")
        .eq("storage_path", row.storage_path)
        .maybeSingle(),
    ]);
    const ownershipError = activeDocumentError ?? pendingUploadError;
    if (ownershipError) {
      failed += 1;
      const attempts = row.attempts + 1;
      const delayMinutes = Math.min(2 ** Math.min(attempts, 10), 24 * 60);
      const { error: retryError } = await supabase
        .from("action_plan_storage_cleanup_queue")
        .update({
          attempts,
          last_error: ownershipError.message.slice(0, 2_000),
          scheduled_for: new Date(nowDate.getTime() + delayMinutes * 60_000).toISOString(),
        })
        .eq("storage_path", row.storage_path);
      logError("Failed to verify action plan object ownership before cleanup", ownershipError, {
        storagePath: row.storage_path,
        attempts,
      });
      if (retryError) {
        logError("Failed to schedule ownership verification retry", retryError, {
          storagePath: row.storage_path,
        });
      }
      continue;
    }
    if (activeDocument || pendingUpload) {
      const { error: deleteError } = await supabase
        .from("action_plan_storage_cleanup_queue")
        .delete()
        .eq("storage_path", row.storage_path);
      if (deleteError) {
        failed += 1;
        logError("Failed to acknowledge owned action plan object", deleteError, {
          storagePath: row.storage_path,
        });
      } else {
        removed += 1;
      }
      continue;
    }

    const { error: storageError } = await supabase.storage
      .from(ACTION_PLAN_DOCUMENT_BUCKET)
      .remove([row.storage_path]);
    const alreadyMissing = Boolean(
      storageError && /not found|does not exist|404/i.test(storageError.message),
    );
    if (!storageError || alreadyMissing) {
      const { error: deleteError } = await supabase
        .from("action_plan_storage_cleanup_queue")
        .delete()
        .eq("storage_path", row.storage_path);
      if (!deleteError) {
        removed += 1;
        continue;
      }
      failed += 1;
      logError("Failed to acknowledge action plan storage cleanup", deleteError, {
        storagePath: row.storage_path,
      });
      continue;
    }

    failed += 1;
    const attempts = row.attempts + 1;
    const delayMinutes = Math.min(2 ** Math.min(attempts, 10), 24 * 60);
    const { error: retryError } = await supabase
      .from("action_plan_storage_cleanup_queue")
      .update({
        attempts,
        last_error: storageError.message.slice(0, 2_000),
        scheduled_for: new Date(nowDate.getTime() + delayMinutes * 60_000).toISOString(),
      })
      .eq("storage_path", row.storage_path);
    logError("Failed to clean queued action plan object", storageError, {
      storagePath: row.storage_path,
      attempts,
    });
    if (retryError) {
      logError("Failed to schedule action plan cleanup retry", retryError, {
        storagePath: row.storage_path,
      });
    }
  }

  return { inspected: rows.length, removed, failed };
}
