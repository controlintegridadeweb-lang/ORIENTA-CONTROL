import { NextResponse } from "next/server";
import { z } from "zod";
import type { RouteHandler } from "@/infrastructure/api/with-route";
import { isRespondentCollectionEditable } from "@/shared/domain/workflow";
import {
  createPendingEvidenceUpload,
  discardPendingEvidenceUpload,
  EVIDENCE_BUCKET,
} from "@/features/evidences/pending-evidence-uploads";
import { describeAllowedEvidenceFile } from "@/features/evidences/file-validation";
import { consumeRateLimit } from "@/infrastructure/security/rate-limit";
import { resolveAuthorizedWorkbenchContext } from "@/features/workbench/authorized-context";
import { lockedEvidenceUploadResponse } from "./http-responses";

const initializeUploadSchema = z.object({
  cycleId: z.string().uuid(),
  filename: z.string().trim().min(1).max(500),
  mimeType: z.string().trim().max(200).nullable().optional(),
  sizeBytes: z.number().int().positive(),
}).strict();

function safeStorageFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180) || "arquivo";
}

export const initializeEvidenceUpload: RouteHandler<Record<string, never>> = async ({
  request,
  auth,
}) => {
  const parsed = initializeUploadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados do arquivo inválidos." }, { status: 400 });
  }

  let descriptor;
  try {
    descriptor = describeAllowedEvidenceFile({
      filename: parsed.data.filename,
      mimeType: parsed.data.mimeType ?? null,
      sizeBytes: parsed.data.sizeBytes,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Arquivo inválido." },
      { status: 400 },
    );
  }

  const rate = await consumeRateLimit({
    scope: "evidence-upload",
    subject: auth.userId,
    limit: 20,
    windowSeconds: 15 * 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Muitos uploads em sequência. Aguarde alguns minutos e tente novamente." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
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

  const pendingUpload = await createPendingEvidenceUpload(supabase, {
    organizationId: scope.cycle.organizationId,
    cycleId: scope.cycle.id,
    uploadedBy: auth.userId,
    originalFilename: parsed.data.filename,
    safeFilename: safeStorageFilename(parsed.data.filename),
    mimeType: descriptor.declaredMimeType || descriptor.canonicalMimeType,
    sizeBytes: parsed.data.sizeBytes,
  });

  const { data: signed, error: signedError } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUploadUrl(pendingUpload.storagePath);
  if (signedError || !signed?.token) {
    await discardPendingEvidenceUpload(supabase, {
      pendingUploadId: pendingUpload.id,
      cycleId: scope.cycle.id,
      organizationId: scope.cycle.organizationId,
      uploadedBy: auth.userId,
    }).catch(() => undefined);
    throw signedError ?? new Error("signed_upload_token_missing");
  }

  return NextResponse.json({
    pendingUploadId: pendingUpload.id,
    storagePath: pendingUpload.storagePath,
    bucket: EVIDENCE_BUCKET,
    expiresAt: pendingUpload.expiresAt,
    uploadToken: signed.token,
  });
};
