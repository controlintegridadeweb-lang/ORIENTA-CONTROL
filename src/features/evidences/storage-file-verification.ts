import "server-only";

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
 * O download usa o cliente de Storage autenticado (service role no workbench),
 * não o `fetch` instrumentado do Next.js — esse `fetch` não conclui o GET da
 * URL assinada para o Storage local (o PUT do navegador retorna 200; o PATCH
 * fica pendente indefinidamente).
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
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) {
    throw new Error(
      `storage_object_download_failed:${error?.message ?? "empty_object"}`,
    );
  }
  return new Uint8Array(await data.arrayBuffer());
}
