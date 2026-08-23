import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
}

/**
 * Kong/PostgREST local reutiliza o socket keep-alive do Node e, no CI, o
 * segundo hop REST da mesma mutação fica preso até o timeout do Kong (~60s)
 * sem o PostgreSQL ter começado a RPC. Fecha a conexão após cada resposta.
 */
function fetchWithoutStaleKeepAlive(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const target =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/i.test(target)) {
    headers.set("Connection", "close");
  }
  return fetch(input, { ...init, headers, cache: "no-store" });
}

export function createSupabaseServiceRoleClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient<Database>(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: fetchWithoutStaleKeepAlive,
    },
  });
}

export function createSupabaseUserClient(accessToken: string) {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: fetchWithoutStaleKeepAlive,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

// Tipo canônico do cliente Supabase usado pelos serviços da aplicação.
import type { SupabaseClient } from "@supabase/supabase-js";
export type TypedSupabaseClient = SupabaseClient<Database>;
