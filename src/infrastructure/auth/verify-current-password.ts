import "server-only";
import { logError } from "@/infrastructure/observability/logger";
import { createSupabaseEphemeralAuthClient } from "@/infrastructure/supabase/server";

export type VerifiedPasswordSession = {
  userId: string;
  release: () => Promise<void>;
};

/**
 * Confere a senha atual numa sessão descartável.
 * Não usa o cliente de cookies: um sign-in no browser substituiria a sessão
 * AAL2 do administrador por AAL1, e o Auth recusa trocar a senha nesse estado.
 */
export async function verifyCurrentPassword(
  email: string,
  password: string,
): Promise<VerifiedPasswordSession | null> {
  const client = createSupabaseEphemeralAuthClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user || !data.session) return null;

  return {
    userId: data.user.id,
    release: async () => {
      const { error: signOutError } = await client.auth.signOut({ scope: "local" });
      if (signOutError) {
        logError("Falha ao encerrar a sessão temporária de verificação de senha", signOutError, {
          scope: "auth:password-change:release",
        });
      }
    },
  };
}
