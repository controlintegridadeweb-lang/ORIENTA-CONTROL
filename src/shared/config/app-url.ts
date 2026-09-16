/**
 * URL pública do app: única fonte de verdade para redirects de auth,
 * metadata absoluta e links gerados no backend.
 *
 * Produção (Vercel): NEXT_PUBLIC_APP_URL é obrigatória. Sem ela, falhamos
 * de forma explícita em vez de cair em localhost ou em um host de preview.
 *
 * Desenvolvimento e preview: localhost:3002, Origin da requisição ou
 * VERCEL_URL — nunca um domínio institucional hardcoded.
 */
const LOCAL_DEV_ORIGIN = "http://localhost:3002";

export function resolveAppOrigin(requestOrigin?: string | null): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return normalizeOrigin(configured);
  }

  if (process.env.VERCEL_ENV === "production") {
    throw new Error("Missing environment variable: NEXT_PUBLIC_APP_URL");
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

  return LOCAL_DEV_ORIGIN;
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
