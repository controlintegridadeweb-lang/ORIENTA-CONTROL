import { parseUuidParam } from "@/shared/validation/uuid";

/**
 * Contexto de navegação das listas administrativas.
 *
 * O retorno é limitado a superfícies conhecidas da plataforma. Isso preserva
 * filtros e recortes sem depender do histórico do navegador nem aceitar URLs
 * externas em parâmetros de consulta.
 */
const ADMIN_LIST_PATHS = [
  "/admin/ciclos",
  "/admin/evidencias",
  "/admin/formularios",
  "/admin/recomendacoes",
  "/admin/plano-acao",
] as const;

export function isSafeAdminListPath(value: string | null | undefined): value is string {
  if (!value || !value.startsWith("/")) return false;
  try {
    const url = new URL(value, "http://orienta.local");
    if (url.origin !== "http://orienta.local") return false;
    if (ADMIN_LIST_PATHS.some((path) => url.pathname === path)) return true;
    const sectionWorkspace = /^\/admin\/plano-acao\/secao\/([^/]+)\/(visao-geral|acoes|monitoramento)$/i.exec(url.pathname);
    return Boolean(
      sectionWorkspace &&
      parseUuidParam(sectionWorkspace[1]) &&
      parseUuidParam(url.searchParams.get("cycleId")),
    );
  } catch {
    return false;
  }
}

export function adminReturnPathOrFallback(
  returnTo: string | null | undefined,
  fallback: string,
): string {
  return isSafeAdminListPath(returnTo) ? returnTo : fallback;
}

export function withAdminReturnPath(path: string, returnTo: string | null | undefined): string {
  if (!isSafeAdminListPath(returnTo)) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}

export function currentAdminListPath(pathname: string, query: string): string {
  return query ? `${pathname}?${query}` : pathname;
}

export function adminReturnLabel(returnPath: string): string {
  if (returnPath.startsWith("/admin/plano-acao/secao/")) {
    return "Voltar ao plano da seção";
  }
  if (returnPath === "/admin/formularios" || returnPath.startsWith("/admin/formularios?")) {
    return "Voltar aos formulários";
  }
  if (returnPath === "/admin/evidencias" || returnPath.startsWith("/admin/evidencias?")) {
    return "Voltar às evidências";
  }
  if (returnPath === "/admin/plano-acao" || returnPath.startsWith("/admin/plano-acao?")) {
    return "Voltar ao Plano de integridade e compliance";
  }
  if (returnPath === "/admin/recomendacoes" || returnPath.startsWith("/admin/recomendacoes?")) {
    return "Voltar às Recomendações";
  }
  return "Voltar ao painel de diagnósticos";
}
