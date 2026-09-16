/**
 * Cookies de sessão host-only.
 *
 * Não definimos `Domain` no cookie de sessão: ele fica preso ao host atual e
 * funciona tanto em `*.vercel.app` quanto no domínio institucional durante a
 * transição. HttpOnly, Secure e SameSite vêm das opções do `@supabase/ssr` e
 * não são relaxados aqui.
 */
export function hostOnlyCookieOptions<T extends object>(
  options: T | undefined,
): Omit<T, "domain"> | undefined {
  if (!options) return options;
  const rest = { ...options } as Omit<T, "domain"> & { domain?: string };
  delete rest.domain;
  return rest;
}
