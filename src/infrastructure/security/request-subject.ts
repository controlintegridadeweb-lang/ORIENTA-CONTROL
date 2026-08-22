import "server-only";

import { createHash } from "node:crypto";

function firstHeaderValue(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first || null;
}

/**
 * Identificador de rede usado apenas como entrada do rate limit. O valor é
 * novamente transformado em chave opaca por `consumeRateLimit` e nunca é
 * persistido em claro.
 */
export function requestNetworkSubject(headers: Pick<Headers, "get">): string {
  return (
    firstHeaderValue(headers.get("cf-connecting-ip")) ??
    firstHeaderValue(headers.get("x-real-ip")) ??
    firstHeaderValue(headers.get("x-forwarded-for")) ??
    "network-unknown"
  );
}

export function normalizedEmailSubject(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}
