import type { AppRole } from "./types";

/**
 * Aceita apenas destinos internos pertencentes à área do papel autenticado.
 * Evita redirecionamento externo e salto entre áreas administrativas.
 */
export function safePostLoginRedirect(
  rawTarget: string | null | undefined,
  role: AppRole,
): string {
  const fallback = role === "admin" ? "/admin" : "/respondente";
  if (!rawTarget) return fallback;

  const target = rawTarget.trim();
  if (!target.startsWith("/") || target.startsWith("//") || target.includes("\\")) {
    return fallback;
  }

  let parsed: URL;
  try {
    parsed = new URL(target, "https://orienta.local");
  } catch {
    return fallback;
  }

  if (parsed.origin !== "https://orienta.local") return fallback;

  const allowedPrefix = role === "admin" ? "/admin" : "/respondente";
  const allowed =
    parsed.pathname === allowedPrefix || parsed.pathname.startsWith(`${allowedPrefix}/`);
  if (!allowed) return fallback;

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
