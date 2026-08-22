import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function opaqueBucketKey(scope: string, subject: string): string {
  return createHash("sha256").update(`${scope}:${subject}`).digest("hex");
}

/**
 * Rate limit persistente e atômico no PostgreSQL. A tabela recebe somente uma
 * chave opaca; identificadores pessoais não são gravados em claro.
 */
export async function consumeRateLimit(input: {
  scope: string;
  subject: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const client = createSupabaseServiceRoleClient();
  const { data, error } = await client.rpc("consume_api_rate_limit", {
    p_bucket_key: opaqueBucketKey(input.scope, input.subject),
    p_limit: input.limit,
    p_window_seconds: input.windowSeconds,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error("rate_limit_result_missing");
  return {
    allowed: row.allowed,
    remaining: Number(row.remaining),
    retryAfterSeconds: Number(row.retry_after_seconds),
  };
}
