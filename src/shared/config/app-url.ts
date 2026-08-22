/**
 * URL publica do app para redirects de auth (recuperacao de senha, etc.).
 *
 * Preferimos NEXT_PUBLIC_APP_URL (canônico / allowlist do Supabase) ao Origin
 * da requisição: previews e hosts alternativos costumam não estar na allowlist
 * e o Auth então redireciona para o Site URL (tela de login) em vez de
 * `/auth/update-password`.
 */
export function resolveAppOrigin(requestOrigin?: string | null): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return normalizeOrigin(configured);
  }

  const fromHeader = requestOrigin?.trim();
  if (fromHeader) {
    return normalizeOrigin(fromHeader);
  }

  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_BRANCH_URL?.trim() ||
    process.env.VERCEL_URL?.trim();

  if (vercelHost) {
    const host = vercelHost.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }

  return "http://localhost:3002";
}

export function passwordRecoveryRedirectUrl(requestOrigin?: string | null): string {
  return `${resolveAppOrigin(requestOrigin)}/auth/update-password`;
}

/**
 * Link de recuperação compatível com o cliente browser em PKCE (`@supabase/ssr`).
 * Usa `token_hash` + `verifyOtp` em `/auth/update-password` — o `action_link`
 * do GoTrue exige code_verifier que o admin/generateLink não cria no browser do usuário.
 */
export function buildPasswordRecoveryLink(
  hashedToken: string,
  requestOrigin?: string | null,
): string {
  const url = new URL(passwordRecoveryRedirectUrl(requestOrigin));
  url.searchParams.set("token_hash", hashedToken);
  url.searchParams.set("type", "recovery");
  return url.toString();
}

function normalizeOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}
