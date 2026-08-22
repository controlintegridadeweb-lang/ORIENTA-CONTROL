import { NextResponse } from "next/server";
import { z } from "zod";
import type { RouteHandler } from "@/infrastructure/api/with-route";
import { isRespondentCollectionEditable } from "@/shared/domain/workflow";
import {
  discardPendingEvidenceUpload,
  EVIDENCE_BUCKET,
  markPendingEvidenceUploadVerified,
} from "@/features/evidences/pending-evidence-uploads";
import { describeAllowedEvidenceFile } from "@/features/evidences/file-validation";
import { verifyStoredEvidenceFile } from "@/features/evidences/storage-file-verification";
import { resolveAuthorizedWorkbenchContext } from "@/features/workbench/authorized-context";
import { recordAudit } from "@/infrastructure/audit/record-audit";
import { logError } from "@/infrastructure/observability/logger";
import { lockedEvidenceUploadResponse } from "./http-responses";

const verifyUploadSchema = z.object({
  cycleId: z.string().uuid(),
  pendingUploadId: z.string().uuid(),
}).strict();

export const verifyEvidenceUpload: RouteHandler<Record<string, never>> = async ({ request, auth }) => {
  const parsed = verifyUploadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados do upload inválidos." }, { status: 400 });
  }

  const access = await resolveAuthorizedWorkbenchContext(auth, parsed.data.cycleId);
  if (access.context === null) return access.error;
  const { scope, supabase } = access.context;
  if (!isRespondentCollectionEditable(scope.cycle.state, scope.cycle.responseCollectionPausedAt)) {
    return lockedEvidenceUploadResponse(
      scope.cycle.state,
      Boolean(scope.cycle.responseCollectionPausedAt),
    );
  }

  const { data: pending, error: pendingError } = await supabase
    .from("pending_evidence_uploads")
    .select("id,storage_path,original_filename,mime_type,size_bytes,expires_at,file_validation_status")
    .eq("id", parsed.data.pendingUploadId)
    .eq("cycle_id", scope.cycle.id)
    .eq("organization_id", scope.cycle.organizationId)
    .eq("uploaded_by", auth.userId)
    .maybeSingle();
  if (pendingError) throw pendingError;
  if (!pending || new Date(pending.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "Upload temporário não encontrado ou expirado." }, { status: 404 });
  }

  if (pending.file_validation_status === "valid") {
    return NextResponse.json({
      pendingUploadId: pending.id,
      storagePath: pending.storage_path,
      bucket: EVIDENCE_BUCKET,
      expiresAt: pending.expires_at,
    });
  }

  const descriptor = describeAllowedEvidenceFile({
    filename: pending.original_filename,
    mimeType: pending.mime_type,
    sizeBytes: Number(pending.size_bytes),
  });
  try {
    const expectedSize = Number(pending.size_bytes);
    const verifiedMimeType = await verifyStoredEvidenceFile({
      supabase,
      bucket: EVIDENCE_BUCKET,
      storagePath: pending.storage_path,
      descriptor,
      expectedSizeBytes: expectedSize,
    });

    const verified = await markPendingEvidenceUploadVerified(supabase, {
      pendingUploadId: pending.id,
      cycleId: scope.cycle.id,
      organizationId: scope.cycle.organizationId,
      uploadedBy: auth.userId,
      verifiedMimeType,
    });
    await recordAudit(supabase, {
      actorUserId: auth.userId,
      eventType: "evidence_upload.confirmed",
      entityType: "pending_evidence_uploads",
      recordId: verified.id,
      after: {
        organizationId: scope.cycle.organizationId,
        cycleId: scope.cycle.id,
        sizeBytes: Number(pending.size_bytes),
        declaredMimeType: pending.mime_type,
        detectedMimeType: verifiedMimeType,
        fileValidationStatus: "valid",
      },
    }).catch((auditError) => {
      logError("Failed to audit evidence upload confirmation", auditError, {
        pendingUploadId: verified.id,
      });
    });
    return NextResponse.json({
      pendingUploadId: verified.id,
      storagePath: verified.storagePath,
      bucket: EVIDENCE_BUCKET,
      expiresAt: verified.expiresAt,
    });
  } catch (error) {
    const rejectionReason =
      error instanceof Error ? error.message : "Não foi possível concluir o envio.";
    await discardPendingEvidenceUpload(supabase, {
      pendingUploadId: pending.id,
      cycleId: scope.cycle.id,
      organizationId: scope.cycle.organizationId,
      uploadedBy: auth.userId,
    }).catch(() => undefined);
    await recordAudit(supabase, {
      actorUserId: auth.userId,
      eventType: "evidence_upload.rejected",
      entityType: "pending_evidence_uploads",
      recordId: pending.id,
      after: {
        organizationId: scope.cycle.organizationId,
        cycleId: scope.cycle.id,
        sizeBytes: Number(pending.size_bytes),
        declaredMimeType: pending.mime_type,
        rejectionReason,
        fileValidationStatus: "rejected",
      },
    }).catch((auditError) => {
      logError("Failed to audit evidence upload rejection", auditError, {
        pendingUploadId: pending.id,
      });
    });
    return NextResponse.json({ error: rejectionReason }, { status: 400 });
  }
};
