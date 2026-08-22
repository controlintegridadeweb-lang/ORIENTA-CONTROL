/**
 * Contrato canônico: dados de perfil no Supabase (`profiles` + `organizations`
 * anexa via FK), expostos na sessão (CurrentUser) e em APIs.
 *
 * - Identidade: `user_id` (auth.users) + email do Auth.
 * - Papel/tenant: `role`, `organization_id`.
 * - Dados pessoais: `full_name` (texto, opcional).
 * - Preferências: `preferences` (JSON, defaults em UI se chave inexistente).
 */
export type ProfilePreferences = Record<string, unknown>;

/** Nome exibido: perfil, senão email formatado, senão fallback. */
export function displayNameFromProfile(
  fullName: string | null,
  email: string | null,
): string {
  const fromProfile = fullName?.trim();
  if (fromProfile) return fromProfile;
  if (!email) return "Usuário";
  const local = email.split("@")[0] ?? email;
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
