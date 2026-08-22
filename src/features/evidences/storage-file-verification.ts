import "server-only";

import type { EvidenceFileDescriptor } from "./file-validation";
import {
  verifyEvidenceFileSignature,
  verifyImageStructuralLimits,
  verifyPdfPageBudget,
  verifyPdfTrailer,
  verifyUploadedFileSize,
} from "./file-validation";

type ByteRangeResult = {
  bytes: Uint8Array;
  totalSize: number | null;
  rangeStart: number | null;
};

async function fetchByteRange(
  url: string,
  range: string,
  maxBytes: number,
): Promise<ByteRangeResult> {
  const response = await fetch(url, {
    headers: { Range: range },
    cache: "no-store",
  });
  if (!response.ok && response.status !== 206) {
    throw new Error(`storage_signature_fetch_failed:${response.status}`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("storage_signature_body_missing");

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const next = await reader.read();
      if (next.done) break;
      const remaining = maxBytes - total;
      const chunk = next.value.slice(0, remaining);
      chunks.push(chunk);
      total += chunk.length;
      if (chunk.length < next.value.length) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  const contentRange = response.headers.get("content-range");
  const rangeMatch = contentRange?.match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i);
  const contentLength = response.headers.get("content-length");
  const rawTotal = rangeMatch?.[3]
    ? Number(rangeMatch[3])
    : response.status === 200 && contentLength
      ? Number(contentLength)
      : null;

  return {
    bytes,
    totalSize: Number.isFinite(rawTotal) ? rawTotal : null,
    rangeStart: rangeMatch ? Number(rangeMatch[1]) : response.status === 200 ? 0 : null,
  };
}

/**
 * Confirma tamanho, assinatura real e estrutura mínima sem transportar o
 * arquivo inteiro pela função serverless. Não executa conteúdo ativo.
 */
export async function verifyStoredEvidenceFile(input: {
  signedUrl: string;
  descriptor: EvidenceFileDescriptor;
  expectedSizeBytes: number;
}): Promise<string> {
  const headSize = Math.min(input.expectedSizeBytes, 65_536);
  const firstRange = await fetchByteRange(input.signedUrl, `bytes=0-${headSize - 1}`, headSize);
  verifyUploadedFileSize(input.expectedSizeBytes, firstRange.totalSize);
  const verifiedMimeType = verifyEvidenceFileSignature(input.descriptor, firstRange.bytes);

  if (
    input.descriptor.extension === "png" ||
    input.descriptor.extension === "jpg" ||
    input.descriptor.extension === "jpeg" ||
    input.descriptor.extension === "webp"
  ) {
    verifyImageStructuralLimits(input.descriptor, firstRange.bytes);
  }

  if (input.descriptor.extension === "pdf") {
    verifyPdfPageBudget(firstRange.bytes);
    const tailSize = Math.min(input.expectedSizeBytes, 2_048);
    const tailStart = Math.max(0, input.expectedSizeBytes - tailSize);
    const tailRange = await fetchByteRange(
      input.signedUrl,
      `bytes=${tailStart}-${input.expectedSizeBytes - 1}`,
      tailSize,
    );
    if (
      tailRange.totalSize !== input.expectedSizeBytes ||
      tailRange.rangeStart !== tailStart
    ) {
      throw new Error("Não foi possível concluir o envio.");
    }
    verifyPdfTrailer(tailRange.bytes);
  }

  return verifiedMimeType;
}
