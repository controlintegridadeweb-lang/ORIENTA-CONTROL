import "server-only";

import { NextResponse } from "next/server";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SAFE_FETCH_SITES = new Set(["same-origin", "none"]);

function normalizeOrigin(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function hasBearerAuthorization(request: Request): boolean {
  return /^Bearer\s+\S+$/i.test(request.headers.get("authorization") ?? "");
}

function environmentOrigin(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  return normalizeOrigin(candidate.includes("://") ? candidate : `https://${candidate}`);
}

function allowedOrigins(request: Request): Set<string> {
  const origins = new Set<string>();

  // Origens canônicas do ambiente (proxy/Vercel/APP_URL).
  for (const value of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    const trusted = environmentOrigin(value);
    if (trusted) origins.add(trusted);
  }

  // Sempre aceitar a origem do próprio request (same-origin real).
  // Sem isso, APP_URL=localhost rejeita acessos legítimos via 127.0.0.1/LAN.
  const requestOrigin = normalizeOrigin(request.url);
  if (requestOrigin) origins.add(requestOrigin);

  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();
  if (forwardedHost && /^(https?)$/i.test(forwardedProto ?? "")) {
    const forwardedOrigin = normalizeOrigin(`${forwardedProto}://${forwardedHost}`);
    if (forwardedOrigin) origins.add(forwardedOrigin);
  }

  return origins;
}

/**
 * Proteção CSRF para mutações autenticadas por cookie.
 *
 * Clientes com Bearer token não dependem de cookies e, portanto, não estão
 * sujeitos ao envio automático de credenciais pelo navegador. Para sessões por
 * cookie, exigimos Origin exato e rejeitamos contextos cross-site informados
 * por Fetch Metadata. A ausência de Origin falha fechada.
 */
export function rejectCrossSiteMutation(request: Request): NextResponse | null {
  if (!MUTATION_METHODS.has(request.method.toUpperCase())) return null;
  if (hasBearerAuthorization(request)) return null;

  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite && !SAFE_FETCH_SITES.has(fetchSite)) {
    return NextResponse.json(
      { error: "Origem da requisição não autorizada." },
      { status: 403 },
    );
  }

  const origin = normalizeOrigin(request.headers.get("origin"));
  if (!origin || !allowedOrigins(request).has(origin)) {
    return NextResponse.json(
      { error: "Origem da requisição não autorizada." },
      { status: 403 },
    );
  }

  return null;
}
