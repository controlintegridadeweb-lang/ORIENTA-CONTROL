import "server-only";

import { fetch as undiciFetch } from "undici";
import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";
import type { EvidenceFileDescriptor } from "./file-validation";
import {
  verifyEvidenceFileSignature,
  verifyImageStructuralLimits,
  verifyPdfPageBudget,
  verifyPdfTrailer,
  verifyUploadedFileSize,
} from "./file-validation";

/**
 * Confirma tamanho, assinatura real e estrutura mínima do objeto já gravado.
 * A URL assinada sai do cliente de Storage. Os bytes vêm pelo fetch do Node,
 * porque o fetch instrumentado do Next.js não conclui o GET do objeto.
 */
export async function verifyStoredEvidenceFile(input: {
  supabase: TypedSupabaseClient;
  bucket: string;
  storagePath: string;
  descriptor: EvidenceFileDescriptor;
  expectedSizeBytes: number;
}): Promise<string> {
  const bytes = await downloadStoredObject(input.supabase, input.bucket, input.storagePath);
  verifyUploadedFileSize(input.expectedSizeBytes, bytes.byteLength);
  const verifiedMimeType = verifyEvidenceFileSignature(input.descriptor, bytes);

  if (
    input.descriptor.extension === "png" ||
    input.descriptor.extension === "jpg" ||
    input.descriptor.extension === "jpeg" ||
    input.descriptor.extension === "webp"
  ) {
    verifyImageStructuralLimits(input.descriptor, bytes);
  }

  if (input.descriptor.extension === "pdf") {
    verifyPdfPageBudget(bytes);
    const tailSize = Math.min(bytes.byteLength, 2_048);
    verifyPdfTrailer(bytes.subarray(bytes.byteLength - tailSize));
  }

  return verifiedMimeType;
}

async function downloadStoredObject(
  supabase: TypedSupabaseClient,
  bucket: string,
  storagePath: string,
): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 60);
  if (error || !data?.signedUrl) {
    throw new Error(
      `storage_object_download_failed:${error?.message ?? "signed_url_missing"}`,
    );
  }
  const response = await undiciFetch(data.signedUrl);
  if (!response.ok) {
    throw new Error(`storage_object_download_failed:${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
