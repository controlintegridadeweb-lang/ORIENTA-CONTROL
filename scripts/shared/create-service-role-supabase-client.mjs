import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env.mjs";

const REQUIRED_ENVIRONMENT_MESSAGE =
  "Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY (defina em .env.local).";

/**
 * Cria o cliente administrativo usado exclusivamente por scripts operacionais.
 * As credenciais são carregadas uma vez e a sessão é sempre efêmera.
 */
export function createServiceRoleSupabaseClient() {
  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error(REQUIRED_ENVIRONMENT_MESSAGE);
  }

  return createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
